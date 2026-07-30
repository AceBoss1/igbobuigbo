// app/api/waitlist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const limited = await rateLimitByIp(req, 'waitlist', 10, 3600);
  if (limited) return NextResponse.json(limited.body, { status: limited.status });

  const { email, name, feature } = await req.json();

  if (!email || !feature) {
    return NextResponse.json({ error: 'email and feature required' }, { status: 400 });
  }

  // Prevent duplicates per feature
  const existing = await adminDb.collection('waitlist')
    .where('email', '==', email)
    .where('feature', '==', feature)
    .limit(1).get();

  if (!existing.empty) {
    return NextResponse.json({ success: true, message: 'Already on waitlist' });
  }

  await adminDb.collection('waitlist').add({
    email,
    name:      name ?? null,
    feature,
    createdAt: new Date(),
  });

  return NextResponse.json({ success: true });
}
