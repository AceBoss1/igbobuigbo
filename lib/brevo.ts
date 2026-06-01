// lib/brevo.ts
interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  name?: string;
}

export async function sendEmail({ to, subject, html, replyTo, name }: EmailPayload) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: {
      'api-key':      process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:       { name: 'Igbobuigbo IBI', email: 'noreply@igbobuigbo.org.ng' },
      to:           [{ email: to, name: name ?? to }],
      replyTo:      replyTo ? { email: replyTo } : { email: 'info@igbobuigbo.org.ng' },
      subject,
      htmlContent:  html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Brevo email error:', err);
    throw new Error(`Brevo: ${err}`);
  }

  return res.json();
}
