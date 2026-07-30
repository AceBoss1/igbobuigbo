// lib/mailer.ts
// Zero-cost email via Gmail SMTP + Nodemailer.
// Account: mailer.igbobuigbo@gmail.com
//
// SETUP (one-time, already done for mailer.igbobuigbo@gmail.com):
//   1. Enable 2-Step Verification on the Gmail account
//   2. Google Account → Security → App Passwords → create one for "Mail"
//   3. Add to .env.local:
//        GMAIL_USER=mailer.igbobuigbo@gmail.com
//        GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
//
// LIMITS (free Gmail):
//   • 500 emails/day  ← plenty for routine birthday/notification volume
//   • 10 MB attachment limit
//   • Zero cost, forever, on the free tier
//
// FALLBACK STRATEGY:
//   Once Gmail's 500/day limit is hit, the platform falls back to Brevo
//   (paid, but reliable) for the remainder of that day's emails.
//   See lib/emailRouter.ts for the combined Gmail-first / Brevo-fallback logic.

import nodemailer from 'nodemailer';

let _transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      'GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env for zero-cost email delivery. ' +
      'See lib/mailer.ts header comment for setup instructions.',
    );
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return _transporter;
}

export interface MailOptions {
  to:      string | string[];
  subject: string;
  html:    string;
  text?:   string;
  from?:   string;
}

/**
 * Send an email via Gmail SMTP (mailer.igbobuigbo@gmail.com).
 * Zero cost up to 500 emails/day.
 * Throws GmailQuotaError-like message when daily limit is hit —
 * callers should catch and fall back to Brevo (see emailRouter.ts).
 */
export async function sendMail(opts: MailOptions): Promise<void> {
  const transporter = getTransporter();

  const fromName    = 'Igbo Bu Igbo — Team IBI';
  const fromAddress = opts.from ?? process.env.GMAIL_USER!;

  await transporter.sendMail({
    from:    `"${fromName}" <${fromAddress}>`,
    to:      Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  });
}

/**
 * Verify SMTP connection — call at startup / health-check to catch
 * mis-configuration (wrong App Password, 2FA not enabled, etc.) early.
 */
export async function verifyMailer(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch (e) {
    console.error('[mailer] SMTP verification failed for mailer.igbobuigbo@gmail.com:', e);
    return false;
  }
}
