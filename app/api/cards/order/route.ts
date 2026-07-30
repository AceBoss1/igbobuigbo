// app/api/cards/order/route.ts
//
// BILLING LOGIC (wallet method):
// DualPayment's wallet tab only validates client-side balance and hands
// control back via onSuccess('wallet') — it does NOT create a transaction
// itself (see components/DualPayment.tsx). The "billedViaRename" lookup
// below is a leftover from an earlier version where it did; it's currently
// dead code (never finds a match) but harmless to leave — every wallet
// card order falls through to the atomicDebit fallback path.

import { NextRequest, NextResponse }  from 'next/server';
import { adminDb }                    from '@/lib/firebase-admin';
import { verifyAuth }                 from '@/lib/auth-middleware';
import { verifyPaystackTransaction }  from '@/lib/paystack';
import { sendSMS }                    from '@/lib/termii';
import { sendEmailSmart as sendEmail }                  from '@/lib/emailRouter';
import { atomicDebit, InsufficientBalanceError, DuressCapExceededError, MemberNotFoundError, PndRestrictedError } from '@/lib/wallet';
import { requireTransactionPin, pinErrorResponse } from '@/lib/pin';

// Prices in Naira — must match what the cards page DISPLAYS
const CARD_PRICES: Record<string, { virtual: number; physical: number | null }> = {
  verve:      { virtual: 1000, physical: 4000  },
  afrigo:     { virtual: 1000, physical: 4000  },
  visa:       { virtual:  200, physical: null   },
  mastercard: { virtual:  200, physical: null   },
};

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardType, cardTier = 'virtual', address, method, reference, pin } = await req.json();

  if (!cardType || !CARD_PRICES[cardType]) {
    return NextResponse.json({ error: 'Invalid cardType' }, { status: 400 });
  }

  const pricing    = CARD_PRICES[cardType];
  const price      = cardTier === 'physical' ? (pricing.physical ?? pricing.virtual) : pricing.virtual;
  const isPhysical = cardTier === 'physical';
  const cardLabel  = `IBI ${cardType.toUpperCase()} Card — ${cardTier}`;

  if (isPhysical && (!address?.street || !address?.city || !address?.state || !address?.phone)) {
    return NextResponse.json({ error: 'Delivery address required for physical card' }, { status: 400 });
  }

  // ── Idempotency: block duplicate orders from double-clicks ────────────────
  if (reference) {
    const dupSnap = await adminDb.collection('cardOrders')
      .where('reference', '==', reference).limit(1).get();
    if (!dupSnap.empty) {
      return NextResponse.json({ success: true, orderId: dupSnap.docs[0].id, duplicate: true });
    }
  }

  // ── Paystack: verify external payment ─────────────────────────────────────
  if (method === 'paystack') {
    if (!reference) {
      return NextResponse.json({ error: 'Payment reference required for Paystack' }, { status: 400 });
    }
    let verified;
    try {
      verified = await verifyPaystackTransaction(reference);
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? 'Payment verification failed' }, { status: 400 });
    }
    if (!verified.status) {
      return NextResponse.json({ error: 'Paystack payment verification failed' }, { status: 400 });
    }
    // Status alone only proves SOME payment succeeded — confirm it matches
    // this exact card/tier's price, so a cheap card's reference can't be
    // replayed against a pricier one.
    if (verified.amount !== price * 100) {
      return NextResponse.json({ error: 'Amount paid does not match card price' }, { status: 400 });
    }
  }

  // ── Wallet: find & rename DualPayment tx, or fall back to fresh debit ─────
  if (method === 'wallet') {
    let pinMode: 'main' | 'duress';
    try {
      pinMode = await requireTransactionPin(auth.uid, pin);
    } catch (e: any) {
      const { status, body } = pinErrorResponse(e);
      return NextResponse.json(body, { status });
    }

    let billedViaRename = false;

    if (reference) {
      try {
        const txSnap = await adminDb.collection('transactions')
          .where('ref',  '==', reference)
          .where('uid',  '==', auth.uid)
          .where('type', '==', 'debit')
          .limit(1).get();

        if (!txSnap.empty) {
          await txSnap.docs[0].ref.update({ description: cardLabel });
          billedViaRename = true;
        }
      } catch {
        // fall through to fresh debit
      }
    }

    if (!billedViaRename) {
      // DualPayment tx not found — debit wallet directly.
      // atomicDebit uses a Firestore transaction so the balance check and
      // the decrement happen together — the previous version here read the
      // balance, checked it, then wrote a decrement via FieldValue.increment()
      // as two separate steps labeled "(atomic)" in a comment, but that
      // increment being atomic doesn't make the CHECK atomic with it —
      // concurrent requests could each pass the check against the same
      // stale balance and each queue a decrement, taking the balance
      // negative. This closes that gap properly.
      let debitResult;
      try {
        debitResult = await atomicDebit(auth.uid, price, {
          description: cardLabel,
          ref: `CARD-${Date.now()}`,
          mode: pinMode,
        });
      } catch (e: any) {
        if (e instanceof InsufficientBalanceError) return NextResponse.json({ error: e.message }, { status: 400 });
        if (e instanceof DuressCapExceededError)   return NextResponse.json({ error: e.message }, { status: 400 });
        if (e instanceof MemberNotFoundError)      return NextResponse.json({ error: e.message }, { status: 404 });
        if (e instanceof PndRestrictedError)      return NextResponse.json({ error: e.message }, { status: 403 });
        throw e;
      }
    }
  }

  // ── Create card order record ──────────────────────────────────────────────
  const orderRef = await adminDb.collection('cardOrders').add({
    uid:             auth.uid,
    ibiNumber:       auth.ibiNumber ?? '',
    cardType,
    cardTier,
    status:          'pending',
    method,
    reference:       reference ?? null,
    amount:          price,
    deliveryAddress: isPhysical ? `${address.street}, ${address.city}, ${address.state}` : 'Virtual',
    address:         isPhysical ? address : null,
    createdAt:       new Date(),
  });

  const shortId     = orderRef.id.slice(0, 8).toUpperCase();
  // auth.phone is not on AuthResult — use delivery address phone for SMS
  const notifyPhone = address?.phone ?? null;

  // ── Notifications ─────────────────────────────────────────────────────────
  await Promise.allSettled([
    notifyPhone && sendSMS(
      notifyPhone,
      `IBI: Card order #${shortId} confirmed — ${cardLabel}. NGN${price.toLocaleString()} charged. ${isPhysical ? 'Delivery: 7-14 days.' : 'Virtual card details coming soon.'} — Igbobuigbo`,
    ),
    auth.email && sendEmail({
      to:      auth.email,
      subject: `Card Order Confirmed — ${cardLabel} #${shortId}`,
      html: `
        <h2 style="color:#8B1A1A">Card Order Confirmed</h2>
        <p>Order ID: <strong>#${shortId}</strong></p>
        <p>Card: <strong>${cardLabel}</strong></p>
        <p>Amount Charged: <strong>NGN ${price.toLocaleString()}</strong></p>
        ${isPhysical
          ? `<p>Delivery: ${address.street}, ${address.city}, ${address.state}</p><p>Expected: 7–14 business days.</p>`
          : '<p>Your virtual card will be activated and sent shortly.</p>'}
        <p>Thank you for being an IBI member.</p>
      `,
    }),
  ]);

  return NextResponse.json({ success: true, orderId: orderRef.id });
}
