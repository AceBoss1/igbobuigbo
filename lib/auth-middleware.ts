// lib/auth-middleware.ts
import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from './firebase-admin';

export interface AuthResult {
  ok: boolean;
  uid: string;
  email: string;
  ibiNumber: string;
  isAdmin: boolean;
}

export async function verifyAuth(
  req: NextRequest
): Promise<AuthResult> {
  const FAIL: AuthResult = {
    ok: false,
    uid: '',
    email: '',
    ibiNumber: '',
    isAdmin: false,
  };

  try {
    // Authorization header first
    const authHeader = req.headers.get('authorization');

    // Bearer header carries a fresh ID token (client components call
    // getIdToken() right before the request), while the __session cookie
    // is a long-lived Firebase *session* cookie minted in
    // /api/auth/session — these use different verify calls.
    let token: string | null = null;
    let isBearer = false;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
      isBearer = true;
    } else {
      token = req.cookies.get('__session')?.value ?? null;
    }

    if (!token) return FAIL;

    const decoded = isBearer
      ? await adminAuth.verifyIdToken(token, true)
      : await adminAuth.verifySessionCookie(token, true);

    // Read member profile
    const memberSnap = await adminDb
      .collection('members')
      .doc(decoded.uid)
      .get();

    const memberData = memberSnap.exists
      ? memberSnap.data()
      : {};

    // Check admin collection
    const adminSnap = await adminDb
      .collection('admins')
      .doc(decoded.uid)
      .get();

    return {
      ok: true,
      uid: decoded.uid,
      email: decoded.email ?? '',
      ibiNumber: memberData?.ibiNumber ?? '',
      isAdmin: adminSnap.exists,
    };
  } catch (e: any) {
    console.warn(
      '[auth-middleware] Token verify failed:',
      e.code ?? e.message
    );

    return FAIL;
  }
}