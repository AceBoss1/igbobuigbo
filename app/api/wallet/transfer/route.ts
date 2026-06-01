// app/api/wallet/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendSMS } from '@/lib/termii';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { recipientIbiNumber, amount, note } = await req.json();

  if (!recipientIbiNumber || !amount || amount < 100) {
    return NextResponse.json({ error: 'recipientIbiNumber and amount (min ₦100) required' }, { status: 400 });
  }

  // Validate IBI number format e.g. LAG/3847291056
  const ibiPattern = /^[A-Z]{2,8}\/\d{10}$/;
  if (!ibiPattern.test(recipientIbiNumber.trim().toUpperCase())) {
    return NextResponse.json({ error: 'Invalid IBI number format. Expected e.g. LAG/3847291056' }, { status: 400 });
  }

  // Sender
  const senderRef  = adminDb.collection('members').doc(auth.uid);
  const senderSnap = await senderRef.get();
  const sender     = senderSnap.data()!;

  if (sender.status !== 'active') {
    return NextResponse.json({ error: 'Only active members can transfer funds' }, { status: 403 });
  }

  if ((sender.walletBalance ?? 0) < amount) {
    return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
  }

  // Recipient lookup by IBI number
  const recipientSnap = await adminDb.collection('members')
    .where('ibiNumber', '==', recipientIbiNumber.trim().toUpperCase())
    .limit(1)
    .get();

  if (recipientSnap.empty) {
    return NextResponse.json({ error: 'Recipient IBI number not found' }, { status: 404 });
  }

  const recipientDoc  = recipientSnap.docs[0];
  const recipientData = recipientDoc.data();

  if (recipientDoc.id === auth.uid) {
    return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 });
  }

  if (recipientData.status !== 'active') {
    return NextResponse.json({ error: 'Recipient account is not active' }, { status: 400 });
  }

  const ref            = `IBI-TRF-${Date.now()}`;
  const senderBalance  = (sender.walletBalance ?? 0) - amount;
  const recipientBalance = (recipientData.walletBalance ?? 0) + amount;
  const now            = new Date();

  // Atomic batch write
  const batch = adminDb.batch();

  batch.update(senderRef, { walletBalance: senderBalance });
  batch.update(recipientDoc.ref, { walletBalance: recipientBalance });

  // Sender debit record
  const senderTxRef = adminDb.collection('transactions').doc();
  batch.set(senderTxRef, {
    uid:         auth.uid,
    type:        'debit',
    amount,
    description: `Transfer to ${recipientData.displayName} (${recipientIbiNumber})${note ? ' — ' + note : ''}`,
    ref,
    balance:     senderBalance,
    createdAt:   now,
  });

  // Recipient credit record
  const recipientTxRef = adminDb.collection('transactions').doc();
  batch.set(recipientTxRef, {
    uid:         recipientDoc.id,
    type:        'credit',
    amount,
    description: `Transfer from ${sender.displayName} (${sender.ibiNumber})${note ? ' — ' + note : ''}`,
    ref,
    balance:     recipientBalance,
    createdAt:   now,
  });

  await batch.commit();

  // SMS notifications (non-blocking)
  await Promise.allSettled([
    sender.phone && sendSMS(
      sender.phone,
      `IBI Wallet: ₦${amount.toLocaleString()} sent to ${recipientData.displayName} (${recipientIbiNumber}). Balance: ₦${senderBalance.toLocaleString()}. Ref: ${ref.slice(-8)}. - IBI`
    ),
    recipientData.phone && sendSMS(
      recipientData.phone,
      `IBI Wallet: ₦${amount.toLocaleString()} received from ${sender.displayName} (${sender.ibiNumber}). Balance: ₦${recipientBalance.toLocaleString()}. Ref: ${ref.slice(-8)}. - IBI`
    ),
  ]);

  return NextResponse.json({
    success:          true,
    reference:        ref,
    senderBalance,
    recipientName:    recipientData.displayName,
    recipientIbiNumber,
    amount,
  });
}
