// app/api/membership/upgrade/route.ts
import { NextRequest, NextResponse }  from 'next/server';
import { adminDb }                    from '@/lib/firebase-admin';
import { verifyAuth }                 from '@/lib/auth-middleware';
import { verifyPaystackTransaction }  from '@/lib/paystack';
import { sendEmailSmart as sendEmail }                  from '@/lib/emailRouter';
import { getPricingSettingsServer }   from '@/lib/pricing-server';
import { atomicDebit, InsufficientBalanceError, DuressCapExceededError, MemberNotFoundError, PndRestrictedError } from '@/lib/wallet';
import { requireTransactionPin, pinErrorResponse } from '@/lib/pin';

const VALID_UPGRADES = ['professional','business','diaspora','patron'];

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reference, tier, method = 'paystack', pin } = await req.json();

  if (!tier || !VALID_UPGRADES.includes(tier)) {
    return NextResponse.json({ error: 'Invalid upgrade tier' }, { status: 400 });
  }
  if (method !== 'wallet' && !reference) {
    return NextResponse.json({ error: 'Payment reference required for card/bank payment' }, { status: 400 });
  }

  // Idempotency: block duplicate reference
  if (reference) {
    const dup = await adminDb.collection('memberUpgrades')
      .where('reference', '==', reference).limit(1).get();
    if (!dup.empty) return NextResponse.json({ success: true, message: 'Already processed' });
  }

  // Fetch member
  const memberRef  = adminDb.collection('members').doc(auth.uid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  const prevTier = memberSnap.data()?.membershipTier ?? 'youth';

  const { registrationFees } = await getPricingSettingsServer();
  const TIER_PRICES: Record<string, number> = {
    professional: registrationFees.professional,
    business:     registrationFees.business,
    patron:       registrationFees.patron,
    // diaspora is USD — handled via Paystack only, not wallet
  };
  const tierLabel = (t: string) =>
    t === 'diaspora' ? `Diaspora — $${registrationFees.diasporaUSD}`
                      : `${t.charAt(0).toUpperCase()}${t.slice(1)} — ₦${(TIER_PRICES[t] ?? 0).toLocaleString()}`;

  const price = TIER_PRICES[tier] ?? 0;

  // ── WALLET payment ────────────────────────────────────────────────────────
  if (method === 'wallet') {
    if (tier === 'diaspora') {
      return NextResponse.json({ error: 'Diaspora tier ($20 USD) must be paid by card/bank' }, { status: 400 });
    }
    if (!price) return NextResponse.json({ error: 'Tier price not configured' }, { status: 400 });

    let pinMode: 'main' | 'duress';
    try {
      pinMode = await requireTransactionPin(auth.uid, pin);
    } catch (e: any) {
      const { status, body } = pinErrorResponse(e);
      return NextResponse.json(body, { status });
    }

    const walletRef = `IBI-UPG-WLT-${Date.now()}`;

    // atomicDebit's memberExtra updates membershipTier in the SAME
    // transaction as the balance check + decrement — previously this used
    // FieldValue.increment() inside a batch, which makes the decrement
    // itself atomic but NOT the insufficient-balance check that happens
    // before it, so concurrent upgrade attempts could each pass the check
    // against the same stale balance and take it negative.
    let debitResult;
    try {
      debitResult = await atomicDebit(auth.uid, price, {
        description: `Membership Upgrade — ${tier.charAt(0).toUpperCase()+tier.slice(1)}`,
        ref: walletRef,
        memberExtra: { membershipTier: tier, upgradedAt: new Date() },
        mode: pinMode,
      });
    } catch (e: any) {
      if (e instanceof InsufficientBalanceError) return NextResponse.json({ error: e.message }, { status: 400 });
      if (e instanceof DuressCapExceededError)   return NextResponse.json({ error: e.message }, { status: 400 });
      if (e instanceof MemberNotFoundError)      return NextResponse.json({ error: e.message }, { status: 404 });
      if (e instanceof PndRestrictedError)      return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    // Upgrade record — non-critical relative to the balance/tier change
    // above, which already succeeded atomically.
    await adminDb.collection('memberUpgrades').add({
      uid:       auth.uid,
      ibiNumber: auth.ibiNumber,
      email:     auth.email,
      fromTier:  prevTier,
      toTier:    tier,
      method:    'wallet',
      reference: walletRef,
      amount:    price,
      createdAt: new Date(),
    });

    await sendUpgradeEmail(auth.email, tier, walletRef, auth.ibiNumber, tierLabel(tier)).catch(() => {});
    return NextResponse.json({ success: true, tier });
  }

  // ── PAYSTACK payment ───────────────────────────────────────────────────────
  let verified;
  try {
    verified = await verifyPaystackTransaction(reference);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Payment verification failed' }, { status: 400 });
  }
  if (!verified.status) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
  }
  // Confirm what was actually charged matches this tier's price — status
  // alone only proves SOME payment succeeded, not that it was for the
  // right amount (a real reference for ₦100 could otherwise be replayed
  // against any tier). Diaspora is exempted: TIER_PRICES has no reliable
  // NGN-equivalent for it yet — pending B-03 (admin USD exchange rate) on
  // the roadmap — so there's nothing correct to compare against today.
  if (tier !== 'diaspora' && verified.amount !== price * 100) {
    return NextResponse.json({ error: 'Amount paid does not match tier price' }, { status: 400 });
  }

  await memberRef.update({ membershipTier: tier, upgradedAt: new Date() });

  await adminDb.collection('memberUpgrades').add({
    uid:       auth.uid,
    ibiNumber: auth.ibiNumber,
    email:     auth.email,
    fromTier:  prevTier,
    toTier:    tier,
    method:    'paystack',
    reference,
    amount:    verified.amount ?? 0,
    createdAt: new Date(),
  });

  await sendUpgradeEmail(auth.email, tier, reference, auth.ibiNumber, tierLabel(tier)).catch(() => {});
  return NextResponse.json({ success: true, tier });
}

async function sendUpgradeEmail(email: string, tier: string, reference: string, ibiNumber: string, label: string) {
  await sendEmail({
    to:      email,
    subject: `IBI Membership Upgraded — Welcome to ${tier.charAt(0).toUpperCase()+tier.slice(1)}!`,
    html: `
      <h2 style="color:#8B1A1A">Membership Upgrade Confirmed</h2>
      <p>Your IBI membership has been successfully upgraded.</p>
      <p><strong>New Tier:</strong> ${label}</p>
      <p><strong>IBI Number:</strong> ${ibiNumber}</p>
      <p><strong>Reference:</strong> ${reference}</p>
      <p>Log in to your dashboard to see your new benefits.</p>
      <p style="margin-top:24px;color:#8B1A1A;font-weight:bold;">Igbo Bu Igbo Unity &amp; Cultural Preservation Initiative</p>
    `,
  });
}
