// app/api/wallet/topup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { sendSMS } from '@/lib/termii';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reference, amount } = await req.json();

  if (!reference || !amount || amount < 100) {
    return NextResponse.json({ error: 'reference and amount (min ₦100) required' }, { status: 400 });
  }

  // Prevent duplicate processing
  const dupSnap = await adminDb.collection('transactions')
    .where('ref', '==', reference).limit(1).get();
  if (!dupSnap.empty) {
    return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
  }

  // Verify Paystack
  const payment = await verifyPaystackTransaction(reference);
  if (!payment.status) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  const verifiedAmount = payment.amount / 100; // convert kobo → naira

  // Update wallet balance
  const memberRef  = adminDb.collection('members').doc(auth.uid);
  const memberSnap = await memberRef.get();
  const member     = memberSnap.data()!;
  const newBalance = (member.walletBalance ?? 0) + verifiedAmount;

  await memberRef.update({ walletBalance: newBalance });

  // Record transaction
  await adminDb.collection('transactions').add({
    uid:         auth.uid,
    type:        'credit',
    amount:      verifiedAmount,
    description: 'Wallet Top-Up via Paystack',
    ref:         reference,
    balance:     newBalance,
    createdAt:   new Date(),
  });

  // SMS notification
  if (member.phone) {
    await sendSMS(
      member.phone,
      `IBI Wallet: ₦${verifiedAmount.toLocaleString()} credited. New balance: ₦${newBalance.toLocaleString()}. Ref: ${reference.slice(-8)}. - Igbobuigbo`
    );
  }

  return NextResponse.json({ success: true, newBalance, amount: verifiedAmount });
}
