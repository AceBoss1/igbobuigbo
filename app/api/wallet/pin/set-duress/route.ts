// app/api/wallet/pin/set-duress/route.ts
// Sets up the duress PIN. Requires the main PIN to verify first — this is
// a deliberate step, not just being logged in, since setting up a duress
// PIN is itself a sensitive action (an attacker with session access alone
// shouldn't be able to configure or overwrite the duress PIN).
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { isValidPinFormat, hashPin, verifyPinHash } from '@/lib/pin';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { duressPin, mainPin } = await req.json();
    if (!isValidPinFormat(duressPin)) {
      return NextResponse.json({ error: 'Duress PIN must be exactly 4 digits' }, { status: 400 });
    }

    const memberRef  = adminDb.collection('members').doc(auth.uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    const m = memberSnap.data()!;

    if (!m.pinHash) {
      return NextResponse.json({ error: 'Set your main PIN first' }, { status: 400 });
    }
    if (!mainPin || !verifyPinHash(mainPin, m.pinHash)) {
      return NextResponse.json({ error: 'Main PIN is incorrect' }, { status: 400 });
    }
    if (duressPin === mainPin) {
      return NextResponse.json({ error: 'Duress PIN must be different from your main PIN' }, { status: 400 });
    }

    await memberRef.update({
      pin2Hash: hashPin(duressPin),
      pin2SetAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[wallet/pin/set-duress]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
