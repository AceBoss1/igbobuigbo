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

export async function verifyAuth(req: NextRequest): Promise<AuthResult> {
  const fail = { ok: false, uid: '', email: '', ibiNumber: '', isAdmin: false };
  try {
    // 1. Try x-uid header (set by middleware after prior verification)
    const headerUid = req.headers.get('x-uid');
    if (headerUid) {
      const snap = await adminDb.collection('members').doc(headerUid).get();
      const data = snap.data() ?? {};
      return {
        ok:        true,
        uid:       headerUid,
        email:     data.email ?? '',
        ibiNumber: data.ibiNumber ?? '',
        isAdmin:   req.headers.get('x-is-admin') === '1',
      };
    }

    // 2. Try Authorization Bearer token
    const authHeader = req.headers.get('Authorization');
    const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies.get('__session')?.value;
    if (!token) return fail;

    const decoded = await adminAuth.verifyIdToken(token);
    const snap    = await adminDb.collection('members').doc(decoded.uid).get();
    const data    = snap.data() ?? {};

    return {
      ok:        true,
      uid:       decoded.uid,
      email:     decoded.email ?? '',
      ibiNumber: data.ibiNumber ?? '',
      isAdmin:   decoded.admin === true,
    };
  } catch {
    return fail;
  }
}
