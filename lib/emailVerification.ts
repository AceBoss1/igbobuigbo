// lib/emailVerification.ts
// Fixes TD-12 (no email verification step after registration).
//
// Uses Firebase Admin's generateEmailVerificationLink() rather than
// Firebase's default verification email so it can go out through Brevo in
// IBI's own branding, alongside the welcome/application-received email
// instead of a separate generic Firebase message.
import { adminAuth } from '@/lib/firebase-admin';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';

const CONTINUE_URL = 'https://igbobuigbo.org.ng/login?verified=1';

export async function sendVerificationEmail(email: string, firstName: string) {
  let link: string;
  try {
    link = await adminAuth.generateEmailVerificationLink(email, { url: CONTINUE_URL });
  } catch (e) {
    // Non-fatal — registration/resend should still succeed even if this
    // particular email fails to send (network blip, rate limit, etc.).
    console.error('[emailVerification] failed to generate link', e);
    return;
  }

  await sendEmail({
    to: email,
    subject: 'Verify your email — Igbo Bu Igbo',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#C8102E;padding:24px;text-align:center;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">Verify Your Email</h1>
        </div>
        <div style="background:#111318;padding:32px;border-radius:0 0 8px 8px;color:#F5F0E8">
          <p>Dear <strong>${firstName}</strong>,</p>
          <p>Please confirm this is your email address to finish securing your IBI account.</p>
          <div style="margin:28px 0;text-align:center">
            <a href="${link}" style="background:#D4AF37;color:#111318;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block">
              Verify Email Address →
            </a>
          </div>
          <p style="color:#6B7280;font-size:12px">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <span style="color:#D4AF37;word-break:break-all">${link}</span>
          </p>
          <p style="color:#6B7280;font-size:12px;margin-top:32px;text-align:center">
            Igbobuigbo.org.ng · info@igbobuigbo.org.ng · +234 (0) 806 787 1203
          </p>
        </div>
      </div>`,
  }).catch(e => console.error('[emailVerification] send failed', e));
}
