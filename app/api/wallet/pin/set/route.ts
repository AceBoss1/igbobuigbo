// app/api/wallet/pin/set/route.ts
// Sets the main PIN (first time) or changes it (requires the current PIN).
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { isValidPinFormat, hashPin, verifyPinHash } from '@/lib/pin';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { newPin, currentPin } = await req.json();
    if (!isValidPinFormat(newPin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    }

    const memberRef  = adminDb.collection('members').doc(auth.uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    const m = memberSnap.data()!;

    // If a PIN already exists, changing it requires proving the current one
    // — first-time setup (no pinHash yet) doesn't need this.
    if (m.pinHash) {
      if (!currentPin || !verifyPinHash(currentPin, m.pinHash)) {
        return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 400 });
      }
    }
    if (newPin === currentPin) {
      return NextResponse.json({ error: 'New PIN must be different from the current one' }, { status: 400 });
    }

    await memberRef.update({
      pinHash: hashPin(newPin),
      pinSetAt: new Date(),
      pinFailCount: 0,
      pinLockedUntil: null,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[wallet/pin/set]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
