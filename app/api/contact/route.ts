// app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    // The submitted `email` field is unverified and gets an auto-reply
    // sent to it — without a limit this is an email-bombing vector against
    // any third-party address, not just spam on your own inbox.
    const limited = await rateLimitByIp(req, 'contact', 5, 3600);
    if (limited) return NextResponse.json(limited.body, { status: limited.status });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const { name, email, phone, dept, subject, message } = body;
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'name, email, and message are required' }, { status: 400 });
    }

    // 1. Save to Firestore (always works, regardless of email config)
    const ref = await adminDb.collection('contactMessages').add({
      name, email,
      phone:   phone   ?? null,
      dept:    dept    ?? null,
      subject: subject ?? null,
      message,
      status:  'unread',
      createdAt: new Date(),
    });

    // 2. Send email to admin (non-blocking — app works without Brevo)
    const adminEmail = process.env.ADMIN_EMAIL ?? 'info@igbobuigbo.org.ng';
    await sendEmail({
      to:      adminEmail,
      subject: `[IBI Contact] ${subject || dept || 'New Message'} — ${name}`,
      html: `<div style="font-family:sans-serif;max-width:600px">
        <h2 style="color:#C8102E">New Contact Form Message</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#666;width:120px">From</td><td style="padding:8px 0;font-weight:600">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${email}">${email}</a></td></tr>
          ${phone ? `<tr><td style="padding:8px 0;color:#666">Phone</td><td style="padding:8px 0">${phone}</td></tr>` : ''}
          ${dept ? `<tr><td style="padding:8px 0;color:#666">Department</td><td style="padding:8px 0">${dept}</td></tr>` : ''}
          ${subject ? `<tr><td style="padding:8px 0;color:#666">Subject</td><td style="padding:8px 0">${subject}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#666;vertical-align:top">Message</td><td style="padding:8px 0;white-space:pre-wrap">${message}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Ref</td><td style="padding:8px 0;font-family:monospace;font-size:0.85em">${ref.id}</td></tr>
        </table>
        <hr style="border:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:0.8em">Reply directly to this email to respond to ${name}.</p>
      </div>`,
      replyTo: email,
    });

    // 3. Auto-reply to sender
    await sendEmail({
      to:      email,
      subject: 'We received your message — Igbo Bu Igbo',
      html: `<div style="font-family:sans-serif;max-width:600px">
        <div style="background:#C8102E;padding:24px;border-radius:8px 8px 0 0;text-align:center">
          <h2 style="color:#fff;margin:0">Message Received ✅</h2>
        </div>
        <div style="background:#111318;padding:32px;border-radius:0 0 8px 8px;color:#F5F0E8">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Thank you for contacting Igbo Bu Igbo. We have received your message${subject ? ` regarding "<strong>${subject}</strong>"` : ''} and will respond within 24 business hours.</p>
          <p style="color:#A8A29E;font-size:0.88em">Reference: <code style="color:#D4AF37">${ref.id}</code></p>
          <hr style="border-color:rgba(255,255,255,0.1);margin:24px 0"/>
          <p style="color:#6B7280;font-size:0.82em">Igbo Bu Igbo Unity &amp; Cultural Preservation Initiative<br/>
          info@igbobuigbo.org.ng · +234 (0) 806 787 1203<br/>
          igbobuigbo.org.ng</p>
        </div>
      </div>`,
    });

    return NextResponse.json({ success: true, ref: ref.id });
  } catch (e: any) {
    console.error('[contact]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
