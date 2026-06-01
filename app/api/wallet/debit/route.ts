// app/api/wallet/debit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendSMS } from '@/lib/termii';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, ref, metadata } = await req.json();

  if (!amount || amount < 100) {
    return NextResponse.json({ error: 'amount (min ₦100) required' }, { status: 400 });
  }

  // Idempotency check
  const dupSnap = await adminDb.collection('transactions').where('ref', '==', ref).limit(1).get();
  if (!dupSnap.empty) {
    return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
  }

  const memberRef  = adminDb.collection('members').doc(auth.uid);
  const memberSnap = await memberRef.get();
  const member     = memberSnap.data()!;

  if ((member.walletBalance ?? 0) < amount) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
  }

  const newBalance = (member.walletBalance ?? 0) - amount;
  const reference  = ref ?? `IBI-WLT-DEB-${Date.now()}`;

  await memberRef.update({ walletBalance: newBalance });

  await adminDb.collection('transactions').add({
    uid:         auth.uid,
    type:        'debit',
    amount,
    description: metadata?.description ?? 'Wallet Payment',
    ref:         reference,
    balance:     newBalance,
    metadata:    metadata ?? {},
    createdAt:   new Date(),
  });

  if (member.phone) {
    await sendSMS(
      member.phone,
      `IBI Wallet: ₦${amount.toLocaleString()} debited. Balance: ₦${newBalance.toLocaleString()}. Ref: ${reference.slice(-8)}. - Igbobuigbo`
    );
  }

  return NextResponse.json({ success: true, reference, newBalance });
}
