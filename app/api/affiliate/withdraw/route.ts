// app/api/affiliate/withdraw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendSMS } from '@/lib/termii';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount } = await req.json();

  if (!amount || amount < 500) {
    return NextResponse.json({ error: 'Minimum withdrawal is ₦500' }, { status: 400 });
  }

  // Fetch pending referral earnings
  const referralsSnap = await adminDb.collection('referrals')
    .where('referrerUid', '==', auth.uid)
    .where('status', '==', 'active')
    .get();

  const totalPending = referralsSnap.docs.reduce((s, d) => s + (d.data().commission ?? 0), 0);

  if (amount > totalPending) {
    return NextResponse.json({ error: `Only ₦${totalPending.toLocaleString()} is available` }, { status: 400 });
  }

  // Credit wallet
  const memberRef  = adminDb.collection('members').doc(auth.uid);
  const memberSnap = await memberRef.get();
  const member     = memberSnap.data()!;
  const newBalance = (member.walletBalance ?? 0) + amount;

  const ref = `IBI-AFF-WD-${Date.now()}`;
  const now = new Date();

  const batch = adminDb.batch();

  // Update wallet
  batch.update(memberRef, { walletBalance: newBalance });

  // Transaction record
  const txRef = adminDb.collection('transactions').doc();
  batch.set(txRef, {
    uid:         auth.uid,
    type:        'credit',
    amount,
    description: 'Affiliate Commission Withdrawal',
    ref,
    balance:     newBalance,
    createdAt:   now,
  });

  // Mark withdrawn referrals (up to the amount)
  let remaining = amount;
  for (const doc of referralsSnap.docs) {
    if (remaining <= 0) break;
    const commission = doc.data().commission ?? 0;
    batch.update(doc.ref, { status: 'withdrawn', withdrawnAt: now, withdrawRef: ref });
    remaining -= commission;
  }

  await batch.commit();

  if (member.phone) {
    await sendSMS(
      member.phone,
      `IBI Affiliate: ₦${amount.toLocaleString()} commission moved to your IBI Wallet. Balance: ₦${newBalance.toLocaleString()}. Ref: ${ref.slice(-8)}. - IBI`
    );
  }

  return NextResponse.json({ success: true, amount, newBalance, reference: ref });
}
