// app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/brevo';

export async function POST(req: NextRequest) {
  const { name, email, phone, dept, subject, message } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'name, email, and message are required' }, { status: 400 });
  }

  // Save to Firestore
  await adminDb.collection('contactMessages').add({
    name, email, phone: phone ?? null,
    department: dept ?? 'General',
    subject:    subject ?? '(No subject)',
    message,
    status:     'unread',
    createdAt:  new Date(),
  });

  // Forward to IBI support via Brevo
  await sendEmail({
    to:      'info@igbobuigbo.org.ng',
    subject: `[${dept ?? 'General'}] ${subject ?? 'New Contact Form Submission'} — ${name}`,
    html: `
      <h3>New Contact Message</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; font-weight: bold;">Name</td><td>${name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Email</td><td>${email}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Phone</td><td>${phone ?? '—'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Department</td><td>${dept ?? 'General'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Subject</td><td>${subject ?? '—'}</td></tr>
      </table>
      <hr/>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br/>')}</p>
    `,
    replyTo: email,
  });

  // Auto-reply to sender
  await sendEmail({
    to:      email,
    subject: 'IBI — We received your message',
    name,
    html:    `<p>Dear ${name},</p><p>Thank you for reaching out to Igbobuigbo (IBI). We have received your message and will respond within 24 business hours.</p><p><strong>Your message:</strong></p><blockquote style="border-left: 3px solid #C8102E; padding-left: 12px; color: #666;">${message}</blockquote><p>Best regards,<br/>IBI Support Team<br/>info@igbobuigbo.org.ng</p>`,
  });

  return NextResponse.json({ success: true });
}
