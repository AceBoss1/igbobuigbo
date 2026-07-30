// app/api/escrow/release/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { requireSuperAdmin, requireAdmin } from '@/lib/admins';
import { atomicCredit, MemberNotFoundError } from '@/lib/wallet';
import { sendSMS } from '@/lib/termii';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';

/**
 * Escrow lifecycle:
 *
 *   gate 1  — buyer confirms goods/service received. Buyer only.
 *
 *   dispute — buyer OR seller OR an admin flags a problem before payout.
 *             No special role required for buyer/seller raising their own
 *             dispute; admin-raised disputes (e.g. IBI detects fraud) go
 *             through the same path.
 *
 *   recommend — an admin reviews a disputed escrow and records a
 *               recommended resolution ('release' to seller or 'refund'
 *               to buyer) with a note. This does NOT move money — it's
 *               the paper trail a superadmin acts on next.
 *
 *   gate 3  — final fund movement. Two paths:
 *     • Normal (never disputed): buyer or seller can trigger it once
 *       gate 1 is confirmed and 48h have passed with no dispute raised —
 *       this is a legitimate merchant sale being paid out, not something
 *       that should need a human admin in the loop at all.
 *     • Disputed: requires SUPERADMIN, and requires an admin's prior
 *       'recommend' call on record — a superadmin cannot release or
 *       refund a disputed escrow without an admin recommendation to act
 *       on first. Executes a release (credit seller) or a refund (credit
 *       buyer) depending on the recorded recommendation.
 *
 * Paystack funding into escrow (buyer paying in) happens elsewhere, at
 * escrow creation — not in this route, and never requires admin either.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { escrowId, gate, disputeReason, resolution, resolutionNote } = await req.json();

  if (!escrowId || !gate) {
    return NextResponse.json({ error: 'escrowId and gate required' }, { status: 400 });
  }

  const escrowRef  = adminDb.collection('escrows').doc(escrowId);
  const escrowSnap = await escrowRef.get();

  if (!escrowSnap.exists) {
    return NextResponse.json({ error: 'Escrow not found' }, { status: 404 });
  }

  const escrow = escrowSnap.data()!;
  const isParty = auth.uid === escrow.buyerUid || auth.uid === escrow.sellerUid;

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

    const sellerSnap = await adminDb.collection('members').doc(escrow.sellerUid).get();
    const seller     = sellerSnap.data();
    if (seller?.phone) {
      await sendSMS(seller.phone, `IBI Escrow [${escrowId.slice(0, 8)}]: Buyer has confirmed receipt. Funds release automatically in 48h if no dispute is raised. - IBI`);
    }

    return NextResponse.json({ success: true, gate: 1, message: 'Gate 1 confirmed. Funds release automatically in 48h unless a dispute is raised.' });
  }

  // ─── Dispute: buyer, seller, or admin flags a problem ────────────
  if (gate === 'dispute') {
    if (!disputeReason) return NextResponse.json({ error: 'disputeReason required' }, { status: 400 });

    let callerIsAdmin = false;
    if (!isParty) {
      try { await requireAdmin(auth.uid); callerIsAdmin = true; }
      catch { return NextResponse.json({ error: 'Only the buyer, seller, or an admin can raise a dispute' }, { status: 403 }); }
    }
    if (!escrow.gate1) return NextResponse.json({ error: 'Gate 1 must be confirmed first' }, { status: 400 });
    if (escrow.gate3)  return NextResponse.json({ error: 'Funds already released — too late to dispute' }, { status: 409 });
    if (escrow.status === 'disputed') return NextResponse.json({ error: 'Already disputed' }, { status: 409 });

    await escrowRef.update({ status: 'disputed', disputeReason, disputeAt: new Date(), disputeBy: auth.uid, disputeByRole: callerIsAdmin ? 'admin' : 'party' });
    return NextResponse.json({ success: true, status: 'disputed' });
  }

  // ─── Recommend: admin reviews a dispute and records a recommendation ──
  if (gate === 'recommend') {
    try {
      await requireAdmin(auth.uid);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (escrow.status !== 'disputed') return NextResponse.json({ error: 'Escrow is not disputed' }, { status: 400 });
    if (resolution !== 'release' && resolution !== 'refund') {
      return NextResponse.json({ error: "resolution must be 'release' or 'refund'" }, { status: 400 });
    }

    await escrowRef.update({
      disputeResolution:     resolution,
      disputeRecommendedBy:  auth.uid,
      disputeRecommendedAt:  new Date(),
      disputeResolutionNote: resolutionNote ?? null,
    });

    // Superadmins need to know a recommendation is waiting on them —
    // this is exactly the kind of thing that otherwise sits unseen.
    const { notifySuperadmins } = await import('@/lib/notifications');
    await notifySuperadmins(
      '⚖️ Escrow dispute recommendation ready',
      `Escrow ${escrowId.slice(0, 8)}: admin recommends "${resolution}". Review and execute in the admin panel.`,
      '/admin',
    ).catch(() => {});

    return NextResponse.json({ success: true, message: `Recommendation recorded: ${resolution}. Awaiting superadmin action.` });
  }

  // ─── Gate 3: Final fund movement ──────────────────────────────────
  if (gate === 3) {
    if (escrow.gate3 === true) {
      return NextResponse.json({ error: 'Funds already released' }, { status: 409 });
    }
    if (!escrow.gate1) {
      return NextResponse.json({ error: 'Gate 1 must be confirmed first' }, { status: 400 });
    }

    const disputed = escrow.status === 'disputed';
    let resolutionToExecute: 'release' | 'refund' = 'release';

    if (disputed) {
      // Disputed path: superadmin only, and only after an admin has
      // recorded a recommendation — a superadmin cannot act on a
      // dispute nobody has actually reviewed.
      try {
        await requireSuperAdmin(auth.uid);
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      if (!escrow.disputeResolution) {
        return NextResponse.json({ error: 'No admin recommendation on record yet — use gate "recommend" first' }, { status: 400 });
      }
      resolutionToExecute = escrow.disputeResolution;
    } else {
      // Normal path: no admin needed at all — this is just a legitimate
      // sale being paid out. Only the buyer or seller (the actual
      // parties) can trigger it, and only once the 48h dispute window
      // since gate 1 has passed.
      if (!isParty) {
        return NextResponse.json({ error: 'Only the buyer or seller can release an undisputed escrow' }, { status: 403 });
      }
      const gate1At = escrow.gate1At?.toDate?.() ?? new Date(0);
      const windowMs = 48 * 60 * 60 * 1000;
      if (Date.now() - gate1At.getTime() < windowMs) {
        const readyAt = new Date(gate1At.getTime() + windowMs);
        return NextResponse.json({ error: `Funds release automatically after the 48h dispute window — ready at ${readyAt.toISOString()}` }, { status: 400 });
      }
    }

    const amount: number = escrow.amount;
    const ibiFee: number = Math.round(amount * 0.015);   // 1.5% IBI fee
    const netAmount: number = amount - ibiFee;
    const recipientUid = resolutionToExecute === 'refund' ? escrow.buyerUid : escrow.sellerUid;

    // atomicCredit does the balance read+write and the transaction
    // record inside one Firestore transaction, and is idempotent on
    // escrowId — a retried/duplicate gate-3 call (double-click, network
    // retry) resolves to the same credit instead of crediting twice.
    let creditResult;
    try {
      creditResult = await atomicCredit(recipientUid, netAmount, {
        description: resolutionToExecute === 'refund'
          ? `Escrow Refund — ${escrow.title ?? escrowId.slice(0, 8)}`
          : `Escrow Release — ${escrow.title ?? escrowId.slice(0, 8)}`,
        ref: `ESC-${escrowId.slice(0, 8)}`,
        clientRequestId: `escrow-release-${escrowId}`,
      });
    } catch (e: any) {
      if (e instanceof MemberNotFoundError) return NextResponse.json({ error: 'Recipient account not found' }, { status: 404 });
      throw e;
    }

    if (resolutionToExecute === 'release') {
      // IBI fee only applies to a genuine sale payout, not a refund back
      // to the buyer — refunding a disputed purchase shouldn't also cost
      // the buyer IBI's service fee on a sale that didn't actually happen.
      await adminDb.collection('ibiFees').add({ escrowId, amount: ibiFee, createdAt: new Date() });
    }

    await escrowRef.update({
      gate3:      true,
      gate3At:    new Date(),
      gate3By:    auth.uid,
      status:     'completed',
      resolution: resolutionToExecute,
      payout:     netAmount,
      ibiFee:     resolutionToExecute === 'release' ? ibiFee : 0,
    });

    const [buyerSnap, sellerSnap] = await Promise.all([
      adminDb.collection('members').doc(escrow.buyerUid).get(),
      adminDb.collection('members').doc(escrow.sellerUid).get(),
    ]);
    const buyer  = buyerSnap.data();
    const seller = sellerSnap.data();

    if (resolutionToExecute === 'release') {
      await Promise.allSettled([
        seller?.phone && sendSMS(seller.phone, `IBI Escrow COMPLETE! ₦${netAmount.toLocaleString()} has been added to your IBI Wallet. Escrow: ${escrowId.slice(0,8)} - IBI`),
        buyer?.phone  && sendSMS(buyer.phone,  `IBI Escrow [${escrowId.slice(0,8)}] is complete. Transaction confirmed and funds released to seller. - IBI`),
        seller?.email && sendEmail({
          to:      seller.email,
          subject: 'IBI Escrow — Funds Released to Your Wallet',
          html:    `<h2>₦${netAmount.toLocaleString()} Received!</h2><p>Escrow ID: ${escrowId}</p><p>IBI service fee: ₦${ibiFee.toLocaleString()} (1.5%)</p><p>Check your IBI Wallet.</p>`,
        }),
      ]);
    } else {
      await Promise.allSettled([
        buyer?.phone  && sendSMS(buyer.phone, `IBI Escrow [${escrowId.slice(0,8)}]: Your dispute was resolved in your favor. ₦${netAmount.toLocaleString()} has been refunded to your IBI Wallet. - IBI`),
        seller?.phone && sendSMS(seller.phone, `IBI Escrow [${escrowId.slice(0,8)}]: This transaction was refunded to the buyer following dispute review. - IBI`),
        buyer?.email && sendEmail({
          to:      buyer.email,
          subject: 'IBI Escrow — Dispute Resolved, Refund Issued',
          html:    `<h2>₦${netAmount.toLocaleString()} Refunded</h2><p>Escrow ID: ${escrowId}</p><p>Your dispute was reviewed and resolved in your favor.</p>`,
        }),
      ]);
    }

    return NextResponse.json({ success: true, gate: 3, resolution: resolutionToExecute, payout: netAmount, ibiFee: resolutionToExecute === 'release' ? ibiFee : 0, message: resolutionToExecute === 'refund' ? `₦${netAmount.toLocaleString()} refunded to buyer wallet.` : `₦${netAmount.toLocaleString()} released to seller wallet.` });
  }

  return NextResponse.json({ error: "Invalid gate value. Use 1, 3, 'dispute', or 'recommend'." }, { status: 400 });
}
