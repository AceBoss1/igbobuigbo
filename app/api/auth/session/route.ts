// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitByIp(req, 'auth-session', 20, 300);
    if (limited) return NextResponse.json(limited.body, { status: limited.status });

    const { idToken } = await req.json();
    if (!idToken) return NextResponse.json({ error: 'idToken required' }, { status: 400 });

    // Verify the token is valid before accepting it
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Mint a real 7-day Firebase session cookie. Firebase ID tokens only
    // live ~1 hour, so previously storing the raw idToken as `__session`
    // meant the cookie itself lasted 7 days but became invalid after an
    // hour — causing repeated forced logouts / login redirect loops.
    // createSessionCookie() gives us a token that is actually valid for
    // the cookie's full lifetime.
    const expiresIn = 60 * 60 * 24 * 7 * 1000; // 7 days, in ms
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ success: true, uid: decoded.uid });

    res.cookies.set('__session', sessionCookie, {
      httpOnly: true,             // no longer needs to be client-readable; Paystack flow uses the idToken directly on the client, not this cookie
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   expiresIn / 1000, // 7 days, in seconds
      path:     '/',
    });

    return res;
  } catch (e: any) {
    console.error('[session/POST]', e.code ?? e.message);
    return NextResponse.json({ error: 'Invalid token: ' + (e.code ?? e.message) }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('__session', '', { maxAge: 0, path: '/' });
  return res;
}
