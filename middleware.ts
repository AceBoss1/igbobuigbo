// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED  = ['/dashboard', '/admin'];
const ADMIN_ONLY = ['/admin'];

// Name of the cookie used to carry the post-login destination.
// See app/login/_LoginContent.tsx for the read side.
const NEXT_COOKIE = 'ibi_redirect_next';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files, Next internals, and open API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/membership/register') ||
    pathname.startsWith('/api/donate') ||
    pathname.startsWith('/api/contact') ||
    pathname.startsWith('/api/waitlist') ||
    pathname.includes('.')
  ) return NextResponse.next();

  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  const isAdmin     = ADMIN_ONLY.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const session = req.cookies.get('__session')?.value;

  if (!session) {
    // NOTE: previously this put the destination in a `?next=` query string
    // (`/login?next=${pathname}`). That's spec-correct locally, but Vercel's
    // edge network has a documented history of mangling query strings on
    // redirect Location headers in production even when the local dev
    // server handles them fine (vercel/next.js#45641, #39017) — which
    // matches members intermittently landing on a %2F-encoded, broken URL
    // that only worked after manually editing it. Redirecting to a clean
    // /login with NO query string, and carrying the destination in a
    // short-lived cookie instead, sidesteps that whole class of bug.
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.set(NEXT_COOKIE, pathname, { path: '/', maxAge: 300, sameSite: 'lax' });
    return res;
  }

  // Verify token via API (edge-safe)
  try {
    const verifyUrl = new URL('/api/auth/verify', req.url);
    const res = await fetch(verifyUrl.toString(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: session }),
    });

    if (!res.ok) throw new Error('invalid');

    const { uid, admin } = await res.json();

    if (isAdmin && !admin) {
      return NextResponse.redirect(new URL('/dashboard/overview', req.url));
    }

    const headers = new Headers(req.headers);
    headers.set('x-uid',      uid);
    headers.set('x-is-admin', admin ? '1' : '0');
    return NextResponse.next({ request: { headers } });

  } catch {
    // Session expired — clear cookie and redirect to login (destination
    // via cookie, same reasoning as above; expired=1 has no slash so it's
    // safe to keep as a plain query flag).
    const loginUrl = new URL('/login?expired=1', req.url);
    const out = NextResponse.redirect(loginUrl);
    out.cookies.set(NEXT_COOKIE, pathname, { path: '/', maxAge: 300, sameSite: 'lax' });
    out.cookies.delete('__session');
    return out;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
