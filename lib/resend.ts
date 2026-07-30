// lib/resend.ts
//
// Same EmailPayload contract as lib/brevo.ts (to, subject, html, replyTo?,
// name?) — lib/emailRouter.ts's fallback chain (Gmail → Resend → Brevo)
// depends on every provider module sharing this shape. `name` isn't
// directly usable by Resend's API (which only takes a flat email string
// per recipient, no separate display name per-recipient the way Brevo's
// API does) — kept in the signature for contract compatibility, silently
// unused here.
import { Resend } from 'resend';

interface EmailPayload { to: string | string[]; subject: string; html: string; replyTo?: string; name?: string; }

export async function sendEmail({ to, subject, html, replyTo }: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = Array.isArray(to) ? to : [to];

  if (!apiKey) {
    console.log(`[Resend] Email NOT sent (no API key). Would have sent to ${recipients.join(', ')}: ${subject}`);
    return null; // gracefully skip — same pattern as lib/brevo.ts, never throws
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from:    'IBI Mailer <noreply@igbobuigbo.org.ng>',
    to:      recipients,
    replyTo: replyTo ?? 'info@igbobuigbo.org.ng',
    subject,
    html,
  });

  if (error) { console.error('Resend error:', error); return null; }
  return data;
}
