// app/api/escrow/release/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendSMS } from '@/lib/termii';
import { sendEmail } from '@/lib/brevo';

/**
 * 3-Gate Escrow Release:
 * Gate 1: Buyer confirms goods/service received
 * Gate 2: IBI Admin approves release (auto if no dispute within 48h)
 * Gate 3: Final: funds transferred from escrow wallet to seller wallet
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { escrowId, gate, disputeReason } = await req.json();

  if (!escrowId || !gate) {
    return NextResponse.json({ error: 'escrowId and gate required' }, { status: 400 });
  }

  const escrowRef  = adminDb.collection('escrows').doc(escrowId);
  const escrowSnap = await escrowRef.get();

  if (!escrowSnap.exists) {
    return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
  }

  const escrow = escrowSnap.data()!;

  // ─── Gate 1: Buyer confirms receipt ──────────────────────────────
  if (gate === 1) {
    if (auth.uid !== escrow.buyerUid) {
      return NextResponse.json({ error: 'Only the buyer can confirm gate 1' }, { status: 403 });
    }
    if (escrow.gate1 === true) {
      return NextResponse.json({ error: 'Gate 1 already confirmed' }, { status: 409 });
    }

    await escrowRef.update({
      gate1:       true,
      gate1At:     new Date(),
      gate1By:     auth.uid,
      status:      'gate1_confirmed',
    });

    // Notify seller: buyer confirmed, waiting admin
    const sellerSnap = await adminDb.collection('members').doc(escrow.sellerUid).get();
    const seller     = sellerSnap.data();
    if (seller?.phone) {
      await sendSMS(seller.phone, `IBI Escrow [${escrowId.slice(0, 8)}]: Buyer has confirmed receipt. Awaiting IBI admin approval (Gate 2). You'll be notified once funds are released. - IBI`);
    }

    // Auto-schedule Gate 2 approval after 48h if no dispute
    await adminDb.collection('escrowAutoApprovals').add({
      escrowId,
      scheduleAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      createdAt:  new Date(),
    });

    return NextResponse.json({ success: true, gate: 1, message: 'Gate 1 confirmed. Admin review pending.' });
  }

  // ─── Gate 2: Admin approves release ──────────────────────────────
  if (gate === 2) {
    const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
    if (!adminSnap.exists && !auth.isAdmin) {
      return NextResponse.json({ error: 'Only IBI admins can approve gate 2' }, { status: 403 });
    }
    if (!escrow.gate1) {
      return NextResponse.json({ error: 'Gate 1 must be confirmed first' }, { status: 400 });
    }
    if (escrow.gate2 === true) {
      return NextResponse.json({ error: 'Gate 2 already approved' }, { status: 409 });
    }

    if (disputeReason) {
      // Admin raised a dispute — freeze escrow
      await escrowRef.update({ status: 'disputed', disputeReason, disputeAt: new Date(), disputeBy: auth.uid });
      return NextResponse.json({ success: true, status: 'disputed' });
    }

    await escrowRef.update({
      gate2:   true,
      gate2At: new Date(),
      gate2By: auth.uid,
      status:  'gate2_approved',
    });

    return NextResponse.json({ success: true, gate: 2, message: 'Gate 2 approved. Ready for final release.' });
  }

  // ─── Gate 3: Final fund release to seller ────────────────────────
  if (gate === 3) {
    const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
    if (!adminSnap.exists && !auth.isAdmin) {
      return NextResponse.json({ error: 'Only IBI admins can trigger gate 3' }, { status: 403 });
    }
    if (!escrow.gate1 || !escrow.gate2) {
      return NextResponse.json({ error: 'Gates 1 and 2 must be confirmed first' }, { status: 400 });
    }
    if (escrow.gate3 === true) {
      return NextResponse.json({ error: 'Funds already released' }, { status: 409 });
    }

    const amount: number = escrow.amount;
    const ibiFee: number = Math.round(amount * 0.015);   // 1.5% IBI fee
    const payout: number = amount - ibiFee;

    // Credit seller wallet
    const sellerRef  = adminDb.collection('members').doc(escrow.sellerUid);
    const sellerSnap = await sellerRef.get();
    const seller     = sellerSnap.data()!;

    await sellerRef.update({
      walletBalance: (seller.walletBalance ?? 0) + payout,
    });

    // IBI fee collection
    await adminDb.collection('ibiFees').add({
      escrowId,
      amount:    ibiFee,
      createdAt: new Date(),
    });

    // Transaction record for seller
    await adminDb.collection('transactions').add({
      uid:         escrow.sellerUid,
      type:        'credit',
      amount:      payout,
      description: `Escrow Release — ${escrow.title ?? escrowId.slice(0, 8)}`,
      ref:         `ESC-${escrowId.slice(0, 8)}`,
      balance:     (seller.walletBalance ?? 0) + payout,
      createdAt:   new Date(),
    });

    // Mark escrow complete
    await escrowRef.update({
      gate3:     true,
      gate3At:   new Date(),
      gate3By:   auth.uid,
      status:    'completed',
      payout,
      ibiFee,
    });

    // Notify both parties
    const [buyerSnap] = await Promise.all([
      adminDb.collection('members').doc(escrow.buyerUid).get(),
    ]);
    const buyer = buyerSnap.data();

    await Promise.allSettled([
      seller?.phone && sendSMS(seller.phone, `IBI Escrow COMPLETE! ₦${payout.toLocaleString()} has been added to your IBI Wallet. Escrow: ${escrowId.slice(0,8)} - IBI`),
      buyer?.phone  && sendSMS(buyer.phone,  `IBI Escrow [${escrowId.slice(0,8)}] is complete. Transaction confirmed and funds released to seller. - IBI`),
      seller?.email && sendEmail({
        to:      seller.email,
        subject: 'IBI Escrow — Funds Released to Your Wallet',
        html:    `<h2>₦${payout.toLocaleString()} Received!</h2><p>Escrow ID: ${escrowId}</p><p>IBI service fee: ₦${ibiFee.toLocaleString()} (1.5%)</p><p>Check your IBI Wallet.</p>`,
      }),
    ]);

    return NextResponse.json({ success: true, gate: 3, payout, ibiFee, message: `₦${payout.toLocaleString()} released to seller wallet.` });
  }

  return NextResponse.json({ error: 'Invalid gate value. Use 1, 2, or 3.' }, { status: 400 });
}
