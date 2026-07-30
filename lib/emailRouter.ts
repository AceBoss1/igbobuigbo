// lib/emailRouter.ts
// Smart router: Gmail SMTP (free, 500/day) first, then Resend (free,
// 3,000/mo) if Gmail fails, then Brevo as the final fallback if both are
// down. Gmail's quota is tracked explicitly (below); Resend and Brevo are
// only ever hit on Gmail failure/exhaustion, so their own free-tier caps
// are rarely a practical concern — no need to track those separately
// unless usage patterns change.
//
// Usage — drop-in replacement for direct sendEmail() calls:
//   import { sendEmailSmart } from '@/lib/emailRouter';
//   await sendEmailSmart({ to, subject, html });

import { adminDb }         from '@/lib/firebase-admin';
import { sendMail }        from '@/lib/mailer';   // Gmail SMTP — free tier
import { sendEmail as sendViaResend } from '@/lib/resend'; // Resend — free tier, 2nd choice
import { sendEmail as sendViaBrevo }  from '@/lib/brevo';  // Brevo — final fallback

const GMAIL_DAILY_LIMIT = 500;

// Keep a safety buffer below Gmail's hard limit to avoid edge-case throttling
const GMAIL_SAFE_LIMIT = 480;

interface EmailParams {
  to:      string | string[];
  subject: string;
  html:    string;
  text?:   string;
}

/** Returns today's date string in WAT (Nigeria time, UTC+1) — used as the Firestore doc ID */
function todayWAT(): string {
  const now    = new Date();
  const watNow = new Date(now.getTime() + 60 * 60 * 1000); // UTC+1
  return watNow.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Atomically increments today's Gmail send counter and returns the new count.
 * Uses a Firestore transaction so concurrent requests don't race past the limit.
 */
async function incrementGmailCounter(): Promise<number> {
  const docRef = adminDb.collection('emailQuota').doc(todayWAT());

  return adminDb.runTransaction(async (tx) => {
    const snap    = await tx.get(docRef);
    const current = snap.exists ? (snap.data()?.gmailSent ?? 0) : 0;
    const next    = current + 1;
    tx.set(docRef, { gmailSent: next, date: todayWAT(), updatedAt: new Date() }, { merge: true });
    return next;
  });
}

/** Reads today's counters without incrementing — useful for admin dashboards */
export async function getEmailQuotaStatus(): Promise<{
  date: string; gmailSent: number; gmailRemaining: number; resendSent: number; brevoSent: number;
}> {
  const docRef = adminDb.collection('emailQuota').doc(todayWAT());
  const snap   = await docRef.get();
  const data   = snap.exists ? snap.data() : null;
  const gmailSent = data?.gmailSent ?? 0;
  return {
    date:           todayWAT(),
    gmailSent,
    gmailRemaining: Math.max(0, GMAIL_SAFE_LIMIT - gmailSent),
    resendSent:     data?.resendSent ?? 0,
    brevoSent:      data?.brevoSent ?? 0,
  };
}

async function incrementResendCounter(): Promise<void> {
  const docRef = adminDb.collection('emailQuota').doc(todayWAT());
  const { FieldValue } = await import('firebase-admin/firestore');
  await docRef.set({ resendSent: FieldValue.increment(1) }, { merge: true });
}

async function incrementBrevoCounter(): Promise<void> {
  const docRef = adminDb.collection('emailQuota').doc(todayWAT());
  await docRef.set(
    { brevoSent: (await docRef.get()).data()?.brevoSent ?? 0 },
    { merge: true },
  ).catch(() => {});
  // Use FieldValue.increment for correctness under concurrency
  const { FieldValue } = await import('firebase-admin/firestore');
  await docRef.set({ brevoSent: FieldValue.increment(1) }, { merge: true });
}

/**
 * Send an email, automatically routing between Gmail (free, first
 * 500/day), Resend (free, 3,000/mo — second choice), and Brevo (final
 * fallback if both are down).
 *
 * Zero-cost in virtually all realistic scenarios — Resend/Brevo are only
 * ever reached on Gmail failure or exhaustion.
 */
export async function sendEmailSmart(params: EmailParams): Promise<{ provider: 'gmail' | 'resend' | 'brevo' | null }> {
  const count = await incrementGmailCounter();

  if (count <= GMAIL_SAFE_LIMIT) {
    try {
      await sendMail(params);
      return { provider: 'gmail' };
    } catch (gmailErr) {
      // Gmail failed for a reason other than quota (auth error, network,
      // TLS/certificate interception, etc.) — fall through to Resend.
      console.error('[emailRouter] Gmail send failed, falling back to Resend:', gmailErr);
    }
  }

  const resendResult = await sendViaResend(params);
  if (resendResult) {
    await incrementResendCounter();
    return { provider: 'resend' };
  }
  console.error('[emailRouter] Resend send failed (or no key), falling back to Brevo');

  // This function itself does NOT throw on total failure (all three
  // providers down) — most of its 20+ callers across this codebase treat
  // email as a best-effort side notification on top of an already-
  // completed action (approving a member, releasing escrow funds,
  // processing a donation), matching the .catch(()=>{}) pattern used
  // everywhere else for non-critical sends. Throwing here would crash
  // those requests even though the real work already succeeded. Instead:
  // log loudly and alert superadmins, so total failure is visible without
  // breaking the caller. Routes where email delivery IS the entire point
  // (e.g. wallet/pin/forgot — silent failure means the user has no way to
  // get their code) check the returned provider for null explicitly and
  // surface their own error to the user.
  const brevoResult = await sendViaBrevo(params);
  if (!brevoResult) {
    console.error('[emailRouter] Gmail, Resend, and Brevo ALL failed for:', params.subject, '→', Array.isArray(params.to) ? params.to.join(',') : params.to);
    const { notifySuperadmins } = await import('@/lib/notifications');
    await notifySuperadmins(
      '🚨 Email delivery failed on all three providers',
      `Subject: "${params.subject}" to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}. Check Gmail/Resend/Brevo credentials.`,
    ).catch(() => {});
    return { provider: null };
  }
  await incrementBrevoCounter();
  return { provider: 'brevo' };
}
