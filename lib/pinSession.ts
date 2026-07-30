// lib/pinSession.ts
//
// After a member verifies their PIN (main or duress) at the session-entry
// gate, something needs to tell subsequent API calls (transfer, etc.)
// which mode is active — but that can NOT be a client-supplied flag in
// the request body. If it were, an attacker forcing someone to enter
// their duress PIN under coercion could simply edit the request to claim
// "main mode" and bypass the entire protection the duress PIN exists to
// provide. The server has to be the one deciding, based on something the
// client can't forge.
//
// This issues a random opaque token, stored server-side in a
// `pinSessions` collection keyed by the token itself, and set as an
// httpOnly cookie (unreadable/untamperable from page JS). Any route that
// needs to know the verified mode reads the cookie, looks up the
// Firestore record, and confirms it belongs to the authenticated uid —
// never trusts anything the client asserts directly.
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const COOKIE_NAME = '__pin_mode';
const SESSION_HOURS = 12;

export async function createPinSession(res: NextResponse, uid: string, mode: 'main' | 'duress') {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await adminDb.collection('pinSessions').doc(token).set({ uid, mode, createdAt: new Date(), expiresAt });

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: SESSION_HOURS * 60 * 60,
  });
}

/**
 * Returns the verified PIN mode for this request, or 'main' if no valid
 * duress session is found — deliberately fails OPEN to 'main' (i.e. no
 * special restriction) rather than blocking the request entirely. This
 * keeps the feature backward-compatible during rollout: a member who
 * hasn't set up a PIN yet, or whose session predates this feature, isn't
 * suddenly locked out of transfers. The duress cap only ever activates
 * for a member who has actively verified a duress PIN this session.
 */
export async function getPinSessionMode(req: NextRequest, uid: string): Promise<'main' | 'duress'> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return 'main';

  const snap = await adminDb.collection('pinSessions').doc(token).get();
  if (!snap.exists) return 'main';
  const data = snap.data()!;

  if (data.uid !== uid) return 'main'; // token doesn't belong to this member — never trust it
  if (data.expiresAt?.toDate?.() < new Date()) return 'main';

  return data.mode === 'duress' ? 'duress' : 'main';
}

export function clearPinSession(res: NextResponse) {
  res.cookies.delete(COOKIE_NAME);
}
