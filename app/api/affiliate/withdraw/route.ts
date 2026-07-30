// app/api/affiliate/withdraw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { requireTransactionPin, pinErrorResponse } from '@/lib/pin';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, pin } = await req.json();
    if (!amount || amount < 500) {
      return NextResponse.json({ error: 'Minimum withdrawal is ₦500' }, { status: 400 });
    }

    // This moves commission into the member's own wallet rather than out
    // of it, but it's still a PIN-gated money-moving action per policy —
    // required fresh, every time, same as debit/transfer.
    try {
      await requireTransactionPin(auth.uid, pin);
    } catch (e: any) {
      const { status, body } = pinErrorResponse(e);
      return NextResponse.json(body, { status });
    }

    const memberRef  = adminDb.collection('members').doc(auth.uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const member     = memberSnap.data()!;
    const newBalance = (member.walletBalance ?? 0) + amount;
    await memberRef.update({ walletBalance: newBalance });

    // Mark referrals as paid
    const pendingSnap = await adminDb.collection('referrals')
      .where('referrerUid','==',auth.uid)
      .where('status','==','pending')
      .get();
    const batch = adminDb.batch();
    pendingSnap.docs.forEach(d => batch.update(d.ref, { status:'paid' }));
    await batch.commit();

    await adminDb.collection('transactions').add({
      uid: auth.uid, type:'credit', amount,
      description: 'Affiliate Commission Payout',
      ref: `AFF-PAY-${Date.now()}`,
      balance: newBalance, createdAt: new Date(),
    });

    return NextResponse.json({ success: true, newBalance });
  } catch (e: any) {
    console.error('[affiliate/withdraw]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
