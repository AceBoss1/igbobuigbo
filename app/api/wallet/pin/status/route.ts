// app/api/wallet/pin/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await adminDb.collection('members').doc(auth.uid).get();
  if (!snap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  const m = snap.data()!;

  return NextResponse.json({
    hasPin:       Boolean(m.pinHash),
    hasDuressPin: Boolean(m.pin2Hash),
  });
}
