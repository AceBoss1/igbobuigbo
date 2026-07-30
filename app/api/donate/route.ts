// app/api/donate/route.ts
//
// WALLET DONATIONS (see TECH_DEBT_AND_ROADMAP.md TD-01, PREFIXES.md §2):
// DualPayment's wallet tab only validates client-side balance and hands
// control back to the caller — it does NOT move any money itself (see
// components/DualPayment.tsx). This route is the single place that
// actually debits the wallet for a donation, atomically, generating the
// dedicated IBI-DON-WLT-{timestamp} reference so wallet donations are
// distinguishable from Paystack ones (both previously shared IBI-DON-,
// and wallet donations were never actually debited at all).
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { atomicDebit, InsufficientBalanceError, DuressCapExceededError, MemberNotFoundError, PndRestrictedError } from '@/lib/wallet';
import { requireTransactionPin, pinErrorResponse } from '@/lib/pin';
import { creditOrgWallet, chapterWalletCode, matchChapterFromText, NATIONAL_CODE } from '@/lib/orgWallets';
import { notifySuperadmins } from '@/lib/notifications';

// Credits the donation into the right org-wallet purse: the donor's
// selected chapter if they picked one explicitly (chapterName from the
// donate form's optional selector), else a best-effort match against
// their free-text message, else the national donation purse. This never
// blocks or fails the donation itself — the money has already moved by
// the time this runs (Paystack charge or wallet debit both already
// succeeded) — a failure here just means bookkeeping is off by one
// donation, which is worth a superadmin alert, not a rolled-back receipt.
async function routeDonationToOrgWallet(amount: number, cause: string, donorName: string, explicitChapter: string | null | undefined, message: string | null | undefined, ref: string) {
  try {
    const chapter = explicitChapter
      ? { name: explicitChapter, code: chapterWalletCode(explicitChapter) }
      : matchChapterFromText(message ?? '');

    const description = `Donation — ${cause} — from ${donorName}`;

    if (chapter) {
      await creditOrgWallet('chapter', chapter.code, `${chapter.name} Chapter`, 'donation', amount, { description, ref });
    } else {
      await creditOrgWallet('national', NATIONAL_CODE, 'IBI National Purse', 'donation', amount, { description, ref });
    }
  } catch (e: any) {
    console.error('[donate/routeDonationToOrgWallet]', e);
    await notifySuperadmins(
      '⚠️ Donation not credited to org wallet',
      `A ₦${amount.toLocaleString()} donation from ${donorName} (ref ${ref}) succeeded but failed to credit its org wallet: ${e.message}. Check manually.`,
    ).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  try {
    const { cause, amount, name, email, message, method, reference, clientRef, pin, chapterName } = await req.json();

    if (!cause || !amount || amount < 100) {
      return NextResponse.json({ error: 'Invalid donation data' }, { status: 400 });
    }

    let donationRef = reference ?? null;
    let donorName   = name ?? 'Anonymous';

    // ── WALLET: debit atomically, server-side ────────────────────────────────
    if (method === 'wallet') {
      const auth = await verifyAuth(req);
      if (!auth.ok) return NextResponse.json({ error: 'Sign in required to donate from wallet' }, { status: 401 });

      let pinMode: 'main' | 'duress';
      try {
        pinMode = await requireTransactionPin(auth.uid, pin);
      } catch (e: any) {
        const { status, body } = pinErrorResponse(e);
        return NextResponse.json(body, { status });
      }

      // Idempotency: block duplicate submits (double-click, retry) using the
      // client-generated clientRef, distinct from the server-generated
      // ledger reference below. atomicDebit ALSO checks its own
      // clientRequestId for the same reason — belt and suspenders, since
      // this check covers the donations collection specifically.
      if (clientRef) {
        const dupSnap = await adminDb.collection('donations')
          .where('clientRef', '==', clientRef).where('donorUid', '==', auth.uid).limit(1).get();
        if (!dupSnap.empty) {
          return NextResponse.json({ success: true, donationId: dupSnap.docs[0].id, duplicate: true });
        }
      }

      const walletRef = `IBI-DON-WLT-${Date.now()}`;

      let debitResult;
      try {
        debitResult = await atomicDebit(auth.uid, amount, {
          description: `Donation — ${cause}${chapterName ? ` (${chapterName})` : ''}`,
          ref: walletRef,
          clientRequestId: clientRef,
          mode: pinMode,
        });
      } catch (e: any) {
        if (e instanceof InsufficientBalanceError) return NextResponse.json({ error: e.message }, { status: 400 });
        if (e instanceof DuressCapExceededError)   return NextResponse.json({ error: e.message }, { status: 400 });
        if (e instanceof MemberNotFoundError)      return NextResponse.json({ error: e.message }, { status: 404 });
        if (e instanceof PndRestrictedError)      return NextResponse.json({ error: e.message }, { status: 403 });
        throw e;
      }

      donorName = name ?? auth.email ?? 'Member';
      const donRefDoc = await adminDb.collection('donations').add({
        cause, amount,
        donorName:  auth.email ? (name ?? 'Member') : donorName,
        donorEmail: email ?? auth.email ?? null,
        donorUid:   auth.uid,
        message: message ?? null,
        chapterName: chapterName ?? null,
        method:  'wallet',
        reference: walletRef,
        clientRef: clientRef ?? null,
        createdAt: new Date(),
      });

      const causeRef  = adminDb.collection('causeTotals').doc(cause);
      const causeSnap = await causeRef.get();
      if (causeSnap.exists) {
        await causeRef.update({ total: (causeSnap.data()!.total ?? 0) + amount, count: (causeSnap.data()!.count ?? 0) + 1 });
      } else {
        await causeRef.set({ cause, total: amount, count: 1 });
      }

      donationRef = walletRef;

      await routeDonationToOrgWallet(amount, cause, donorName, chapterName, message, walletRef);
      await sendDonationEmails({ cause, amount, name: donorName, email: email ?? auth.email, message, method: 'wallet', reference: walletRef, donationId: donRefDoc.id, chapterName }).catch(() => {});
      return NextResponse.json({ success: true, donationId: donRefDoc.id, reference: walletRef, duplicate: debitResult.duplicate });
    }

    // ── PAYSTACK: verify, then just record (money already moved via Paystack) ──
    if (method === 'paystack' && reference) {
      const payment = await verifyPaystackTransaction(reference);
      if (!payment.status) {
        return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
      }
      // Status alone only proves SOME payment succeeded — confirm the amount
      // being recorded actually matches what Paystack confirms was paid, so
      // a small real payment can't be recorded as a large fake donation.
      if (payment.amount !== amount * 100) {
        return NextResponse.json({ error: 'Amount does not match verified payment' }, { status: 400 });
      }
    }

    const donRef = await adminDb.collection('donations').add({
      cause,
      amount,
      donorName,
      donorEmail: email ?? null,
      message:    message ?? null,
      chapterName: chapterName ?? null,
      method,
      reference:  donationRef,
      createdAt:  new Date(),
    });

    const causeRef  = adminDb.collection('causeTotals').doc(cause);
    const causeSnap = await causeRef.get();
    if (causeSnap.exists) {
      await causeRef.update({ total: (causeSnap.data()!.total ?? 0) + amount, count: (causeSnap.data()!.count ?? 0) + 1 });
    } else {
      await causeRef.set({ cause, total: amount, count: 1 });
    }

    await sendDonationEmails({ cause, amount, name: donorName, email, message, method, reference: donationRef, donationId: donRef.id, chapterName }).catch(() => {});
    await routeDonationToOrgWallet(amount, cause, donorName, chapterName, message, donationRef ?? donRef.id);
    return NextResponse.json({ success: true, donationId: donRef.id });
  } catch (e: any) {
    // This is the fix for the actual bug being reported: previously there
    // was no top-level catch here, so an unexpected exception (anywhere in
    // the function) produced Next.js's own opaque 500 with no `.error`
    // field — the client's `data.error` was always undefined, so every
    // real failure showed the same generic "Could not record donation"
    // with zero information about what actually broke. Now the real
    // message reaches the client (and the toast), and gets logged
    // server-side either way.
    console.error('[POST /api/donate]', e);
    return NextResponse.json({ error: e.message ?? 'Unexpected server error' }, { status: 500 });
  }
}

async function sendDonationEmails(opts: {
  cause: string; amount: number; name: string; email?: string | null;
  message?: string | null; method: string; reference?: string | null; donationId: string; chapterName?: string | null;
}) {
  const { cause, amount, name, email, message, method, reference, donationId, chapterName } = opts;

  // Receipt email to donor
  if (email && name !== 'Anonymous') {
    await sendEmail({
      to:      email,
      subject: `IBI Donation Receipt — ₦${amount.toLocaleString()}`,
      name,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #C8102E; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0;">Thank You, ${name}! 🙏</h1>
          </div>
          <div style="background: #111318; padding: 32px; border-radius: 0 0 8px 8px; color: #F5F0E8;">
            <p>Your generous donation has been received by Igbobuigbo IBI.</p>
            <div style="background: #16191F; border: 1px solid #D4AF37; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse; color: #F5F0E8;">
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Donation ID</td><td style="text-align: right; font-family: monospace;">${donationId.slice(0, 12).toUpperCase()}</td></tr>
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Amount</td><td style="text-align: right; font-weight: 700; color: #D4AF37; font-family: monospace;">₦${amount.toLocaleString()}</td></tr>
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Cause</td><td style="text-align: right; text-transform: capitalize;">${cause}</td></tr>
                ${chapterName ? `<tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Chapter Credited</td><td style="text-align: right;">${chapterName}</td></tr>` : ''}
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Payment Method</td><td style="text-align: right; text-transform: capitalize;">${method}</td></tr>
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Reference</td><td style="text-align: right; font-family: monospace;">${reference ?? 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Date</td><td style="text-align: right;">${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
              </table>
            </div>
            ${message ? `<p style="color: #A8A29E; font-style: italic;">"${message}"</p>` : ''}
            <p style="color: #6B7280; font-size: 12px; margin-top: 32px; text-align: center;">
              Igbobuigbo.org.ng — Igbo Business Union International<br/>
              This is your official donation receipt. Please keep it for your records.
            </p>
          </div>
        </div>
      `,
    });
  }

  // Notify IBI finance team
  await sendEmail({
    to:      'finance@igbobuigbo.org.ng',
    subject: `New Donation — ₦${amount.toLocaleString()} (${cause})`,
    html:    `<p><strong>${name}</strong> donated <strong>₦${amount.toLocaleString()}</strong> to the <strong>${cause}</strong> fund via ${method}. Reference: ${reference ?? 'N/A'}. Donation ID: ${donationId}</p>`,
  });
}
