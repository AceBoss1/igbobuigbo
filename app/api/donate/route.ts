// app/api/donate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { sendEmail } from '@/lib/brevo';

export async function POST(req: NextRequest) {
  const { cause, amount, name, email, message, method, reference } = await req.json();

  if (!cause || !amount || amount < 100) {
    return NextResponse.json({ error: 'Invalid donation data' }, { status: 400 });
  }

  // Verify Paystack payment if card method
  if (method === 'paystack' && reference) {
    const payment = await verifyPaystackTransaction(reference);
    if (!payment.status) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }
  }

  // Save donation record
  const donRef = await adminDb.collection('donations').add({
    cause,
    amount,
    donorName:  name ?? 'Anonymous',
    donorEmail: email ?? null,
    message:    message ?? null,
    method,
    reference:  reference ?? null,
    createdAt:  new Date(),
  });

  // Update cause total
  const causeRef  = adminDb.collection('causeTotals').doc(cause);
  const causeSnap = await causeRef.get();
  if (causeSnap.exists) {
    await causeRef.update({ total: (causeSnap.data()!.total ?? 0) + amount, count: (causeSnap.data()!.count ?? 0) + 1 });
  } else {
    await causeRef.set({ cause, total: amount, count: 1 });
  }

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
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Donation ID</td><td style="text-align: right; font-family: monospace;">${donRef.id.slice(0, 12).toUpperCase()}</td></tr>
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Amount</td><td style="text-align: right; font-weight: 700; color: #D4AF37; font-family: monospace;">₦${amount.toLocaleString()}</td></tr>
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Cause</td><td style="text-align: right; text-transform: capitalize;">${cause}</td></tr>
                <tr><td style="padding: 8px 0; color: #A8A29E; font-size: 13px;">Payment Method</td><td style="text-align: right; text-transform: capitalize;">${method}</td></tr>
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
    html:    `<p><strong>${name ?? 'Anonymous'}</strong> donated <strong>₦${amount.toLocaleString()}</strong> to the <strong>${cause}</strong> fund via ${method}. Reference: ${reference ?? 'N/A'}. Donation ID: ${donRef.id}</p>`,
  });

  return NextResponse.json({ success: true, donationId: donRef.id });
}
