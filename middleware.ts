// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth protection for /dashboard routes.
 * Reads the Firebase ID token from the '__session' cookie
 * (set by the client after Firebase auth) and validates it
 * server-side using Firebase Admin SDK via the /api/auth/verify edge function.
 *
 * Protected paths: /dashboard/*
 * Admin paths:     /api/admin/* (require admin claim)
 */

const PROTECTED_PATHS  = ['/dashboard'];
const ADMIN_API_PATHS  = ['/api/admin'];
const PUBLIC_PATHS     = ['/login', '/signup', '/membership', '/', '/donate', '/contact', '/coming-soon'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Skip static files, Next internals, and public API routes ──
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/membership') ||
    pathname.startsWith('/api/donate') ||
    pathname.startsWith('/api/contact') ||
    pathname.startsWith('/api/waitlist') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  const isAdminAPI  = ADMIN_API_PATHS.some(p => pathname.startsWith(p));

  if (!isProtected && !isAdminAPI) {
    return NextResponse.next();
  }

  // ── Read session cookie ───────────────────────────────────────
  const session = req.cookies.get('__session')?.value;

  if (!session) {
    // No token — redirect to login with return URL
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Verify token via edge-compatible endpoint ─────────────────
  try {
    const verifyUrl = new URL('/api/auth/verify', req.url);
    const verifyRes = await fetch(verifyUrl.toString(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `__session=${session}` },
      body:    JSON.stringify({ token: session }),
    });

    if (!verifyRes.ok) {
      throw new Error('Token invalid');
    }

    const { uid, admin } = await verifyRes.json();

    // Admin-only API routes
    if (isAdminAPI && !admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Forward verified UID to downstream handlers via headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-uid',      uid);
    requestHeaders.set('x-is-admin', admin ? '1' : '0');

    return NextResponse.next({ request: { headers: requestHeaders } });

  } catch {
    // Token invalid or expired — clear cookie and redirect to login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('expired', '1');

    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('__session');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image  (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
