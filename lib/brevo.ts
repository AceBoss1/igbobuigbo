// lib/brevo.ts
// `to` matches lib/mailer.ts's MailOptions.to (string | string[]) — the two
// backends lib/emailRouter.ts transparently swaps between (Gmail-first,
// Brevo-fallback) need the same recipient contract, or the fallback path
// breaks for any multi-recipient call that only Gmail's `sendMail` could
// previously handle. Brevo's API natively accepts an array of recipient
// objects in `to`, so this isn't a workaround — it was just never wired up.
interface EmailPayload { to: string | string[]; subject:string; html:string; replyTo?:string; name?:string; }

export async function sendEmail({ to, subject, html, replyTo, name }: EmailPayload) {
  const apiKey = process.env.BREVO_API_KEY;
  const recipients = Array.isArray(to) ? to : [to];

  if (!apiKey) {
    console.log(`[Brevo] Email NOT sent (no API key). Would have sent to ${recipients.join(', ')}: ${subject}`);
    return null; // gracefully skip
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:'POST',
    headers:{ 'api-key':apiKey, 'Content-Type':'application/json' },
    body: JSON.stringify({
      sender:      { name:'Igbo Bu Igbo IBI', email:'noreply@igbobuigbo.org.ng' },
      to:          recipients.map(email => ({ email, name: name ?? email })),
      replyTo:     replyTo ? { email:replyTo } : { email:'info@igbobuigbo.org.ng' },
      subject, htmlContent:html,
    }),
  });
  if (!res.ok) { const e = await res.text(); console.error('Brevo error:', e); }
  return res.ok ? res.json() : null;
}
