// app/api/webhooks/paystack/route.ts
//
// Fixes TD-03 (no server-side Paystack webhook). Until now, every payment
// flow relied entirely on the CLIENT calling back to our own API after
// Paystack's popup reported success — if the tab closed, the network
// dropped, or (as found this session) the callback was simply never wired
// up to real verification at all (see wallet/topup's fix), money could
// change hands with nothing recorded on our side, or be recorded without
// ever being verified.
//
// This webhook is a safety net, not the primary path — each existing route
// (upgrade, donate, cards/order, wallet/topup) still verifies and records
// its own successful client-driven calls, and this handler checks for that
// existing record FIRST and no-ops if found. It only completes the action
// itself when nothing was ever recorded, using the SAME collections, SAME
// idempotency key (the reference), and (where a price is known) the SAME
// amount-match check the primary routes now enforce.
//
// Registration (IBI-REG-) is deliberately NOT auto-completed here — that
// requires creating a Firebase Auth user, which needs a password we don't
// have server-side. Instead, this sends an admin alert so a human can
// follow up if a paid registration looks stuck.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/brevo';
import { getPricingSettingsServer } from '@/lib/pricing-server';

export async function POST(req: NextRequest) {
  // Signature is computed over the RAW body — must read as text before any
  // JSON parsing, or the HMAC will never match.
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    console.error('[webhook/paystack] PAYSTACK_SECRET_KEY not configured');
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const expectedSig = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  if (!signature || signature !== expectedSig) {
    console.warn('[webhook/paystack] invalid signature — possible spoofed request');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Acknowledge anything we don't act on — Paystack retries non-2xx
  // responses, and we only care about successful charges here.
  if (event.event !== 'charge.success') {
    return NextResponse.json({ received: true });
  }

  const data        = event.data ?? {};
  const reference    = data.reference as string;
  const amountKobo   = data.amount as number;
  const metadata     = data.metadata ?? {};
  const email        = data.customer?.email as string | undefined;

  if (!reference || typeof amountKobo !== 'number') {
    return NextResponse.json({ received: true });
  }

  try {
    await routeByPrefix(reference, amountKobo, metadata, email);
  } catch (e) {
    console.error('[webhook/paystack] processing failed', reference, e);
    await sendEmail({
      to: 'finance@igbobuigbo.org.ng',
      subject: `⚠️ Webhook processing failed — ${reference}`,
      html: `<p>Paystack confirms <strong>${reference}</strong> (₦${(amountKobo / 100).toLocaleString()}) succeeded, but our webhook handler threw an error while processing it. Needs manual review.</p><pre>${String(e)}</pre>`,
    }).catch(() => {});
  }

  // Always 200 once signature-verified and parsed — we've either handled
  // it, safely no-op'd (already processed by the client path), or logged
  // it for manual follow-up above. Returning non-2xx here would just make
  // Paystack retry a request we've already fully evaluated.
  return NextResponse.json({ received: true });
}

async function routeByPrefix(reference: string, amountKobo: number, metadata: any, email?: string) {
  const ref = reference.toUpperCase();

  // Order matters — more specific prefixes must be checked first, same
  // rule as the /verify portal (see PREFIXES.md §6).
  if (ref.startsWith('IBI-UPG-WLT-')) return; // wallet upgrades never touch Paystack
  if (ref.startsWith('IBI-UPG-'))     return completeUpgrade(reference, amountKobo, metadata);
  if (ref.startsWith('IBI-DON-WLT-')) return; // wallet donations never touch Paystack
  if (ref.startsWith('IBI-DON-'))     return completeDonation(reference, amountKobo, metadata, email);
  if (ref.startsWith('IBI-CARD-'))    return completeCardOrder(reference, amountKobo, metadata);
  if (ref.startsWith('IBI-WLT-'))     return completeTopup(reference, amountKobo, metadata);
  if (ref.startsWith('IBI-REG-'))     return flagStuckRegistration(reference, amountKobo, email);
  // Unknown/unrecognised prefix — nothing this webhook knows how to
  // safety-net; just acknowledge and move on.
}

async function completeUpgrade(reference: string, amountKobo: number, metadata: any) {
  const dup = await adminDb.collection('memberUpgrades').where('reference', '==', reference).limit(1).get();
  if (!dup.empty) return; // client's own call already completed this

  const uid  = metadata?.uid;
  const tier = metadata?.tier;
  if (!uid || !tier) {
    console.warn('[webhook/paystack] upgrade missing uid/tier in metadata, cannot safety-net', reference);
    return;
  }

  const { registrationFees } = await getPricingSettingsServer();
  const TIER_PRICES: Record<string, number> = {
    professional: registrationFees.professional,
    business:     registrationFees.business,
    patron:       registrationFees.patron,
  };
  const expectedKobo = (TIER_PRICES[tier] ?? 0) * 100;
  if (tier !== 'diaspora' && amountKobo !== expectedKobo) {
    console.warn('[webhook/paystack] upgrade amount mismatch, skipping', reference, amountKobo, expectedKobo);
    return;
  }

  const memberRef  = adminDb.collection('members').doc(uid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) return;
  const prevTier = memberSnap.data()?.membershipTier ?? 'youth';

  await memberRef.update({ membershipTier: tier, upgradedAt: new Date() });
  await adminDb.collection('memberUpgrades').add({
    uid, fromTier: prevTier, toTier: tier, method: 'paystack',
    reference, amount: amountKobo, createdAt: new Date(),
    completedVia: 'webhook',
  });
}

async function completeDonation(reference: string, amountKobo: number, metadata: any, email?: string) {
  const dup = await adminDb.collection('donations').where('reference', '==', reference).limit(1).get();
  if (!dup.empty) return;

  const cause  = metadata?.cause ?? 'general';
  const amount = amountKobo / 100;

  await adminDb.collection('donations').add({
    cause, amount,
    donorName:  metadata?.donorName ?? 'Anonymous',
    donorEmail: email ?? null,
    message:    metadata?.message ?? null,
    method: 'paystack', reference, createdAt: new Date(),
    completedVia: 'webhook',
  });

  const causeRef  = adminDb.collection('causeTotals').doc(cause);
  const causeSnap = await causeRef.get();
  if (causeSnap.exists) {
    await causeRef.update({ total: (causeSnap.data()!.total ?? 0) + amount, count: (causeSnap.data()!.count ?? 0) + 1 });
  } else {
    await causeRef.set({ cause, total: amount, count: 1 });
  }
}

async function completeCardOrder(reference: string, amountKobo: number, metadata: any) {
  const dup = await adminDb.collection('cardOrders').where('reference', '==', reference).limit(1).get();
  if (!dup.empty) return;

  const uid      = metadata?.uid;
  const cardType = metadata?.cardType;
  const cardTier = metadata?.cardTier ?? 'virtual';
  if (!uid || !cardType) {
    console.warn('[webhook/paystack] card order missing uid/cardType in metadata, cannot safety-net', reference);
    return;
  }

  await adminDb.collection('cardOrders').add({
    uid, cardType, cardTier,
    address: metadata?.address ?? null,
    method: 'paystack', reference, amount: amountKobo / 100,
    status: 'pending', createdAt: new Date(),
    completedVia: 'webhook',
  });
}

async function completeTopup(reference: string, amountKobo: number, metadata: any) {
  const dup = await adminDb.collection('transactions').where('ref', '==', reference).limit(1).get();
  if (!dup.empty) return;

  const uid = metadata?.uid;
  if (!uid) {
    console.warn('[webhook/paystack] topup missing uid in metadata, cannot safety-net', reference);
    return;
  }

  const memberRef  = adminDb.collection('members').doc(uid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) return;

  const amount     = amountKobo / 100;
  const newBalance = (memberSnap.data()!.walletBalance ?? 0) + amount;

  await memberRef.update({ walletBalance: newBalance });
  await adminDb.collection('transactions').add({
    uid, type: 'credit', amount,
    description: 'Wallet Top-Up via Paystack',
    ref: reference, balance: newBalance, createdAt: new Date(),
    completedVia: 'webhook',
  });
}

// Registration can't be safely auto-completed from a webhook (no password
// to create the Firebase Auth user with) — flag it for a human instead.
async function flagStuckRegistration(reference: string, amountKobo: number, email?: string) {
  const existing = await adminDb.collection('members').where('paystackRef', '==', reference).limit(1).get();
  if (!existing.empty) return; // registration completed normally

  await sendEmail({
    to: 'finance@igbobuigbo.org.ng',
    subject: `⚠️ Paid registration may be stuck — ${reference}`,
    html: `<p>Paystack confirms a successful ₦${(amountKobo / 100).toLocaleString()} charge for reference <strong>${reference}</strong>${email ? ` (${email})` : ''}, but no member record references it. This usually means the browser tab closed right after payment before registration could complete. Please check manually.</p>`,
  }).catch(() => {});
}
