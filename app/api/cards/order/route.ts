// app/api/cards/order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { sendSMS } from '@/lib/termii';
import { sendEmail } from '@/lib/brevo';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardType, address, method, reference } = await req.json();

  if (!cardType || !address?.street || !address?.city || !address?.state || !address?.phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify Paystack payment (if card payment)
  if (method === 'paystack' && reference) {
    const verified = await verifyPaystackTransaction(reference);
    if (!verified.status) return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  const CARD_PRICES: Record<string, number> = { verve: 2500, visa: 5000 };
  const price = CARD_PRICES[cardType];
  if (!price) return NextResponse.json({ error: 'Invalid card type' }, { status: 400 });

  // For wallet payment, debit wallet
  if (method === 'wallet') {
    const memberSnap = await adminDb.collection('members').doc(auth.uid).get();
    const member = memberSnap.data();
    if ((member?.walletBalance ?? 0) < price) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }
    await adminDb.collection('members').doc(auth.uid).update({
      walletBalance: (member?.walletBalance ?? 0) - price,
    });
    // Record debit transaction
    await adminDb.collection('transactions').add({
      uid: auth.uid,
      type: 'debit',
      amount: price,
      description: `IBI ${cardType.toUpperCase()} Card Order`,
      ref: reference ?? `IBI-CARD-WALLET-${Date.now()}`,
      balance: (member?.walletBalance ?? 0) - price,
      createdAt: new Date(),
    });
  }

  // Create order document
  const orderRef = await adminDb.collection('cardOrders').add({
    uid:             auth.uid,
    ibiNumber:       auth.ibiNumber,
    cardType,
    status:          'pending',
    deliveryAddress: `${address.street}, ${address.city}, ${address.state}`,
    address,
    method,
    reference:       reference ?? null,
    amount:          price,
    createdAt:       new Date(),
  });

  // Notify member
  await Promise.allSettled([
    sendSMS(address.phone, `IBI Card Order Confirmed! Your ${cardType.toUpperCase()} card order #${orderRef.id.slice(0, 8)} has been placed. Delivery in 5-10 business days. - IBI`),
    sendEmail({
      to:      auth.email,
      subject: `IBI ${cardType.toUpperCase()} Card Order Confirmed`,
      html:    `<h2>Card Order Confirmed</h2><p>Order ID: ${orderRef.id}</p><p>Delivery to: ${address.street}, ${address.city}, ${address.state}</p><p>We'll notify you when your card is dispatched.</p>`,
    }),
  ]);

  return NextResponse.json({ success: true, orderId: orderRef.id });
}
