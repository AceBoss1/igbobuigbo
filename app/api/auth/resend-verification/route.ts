// app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendVerificationEmail } from '@/lib/emailVerification';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!auth.email) return NextResponse.json({ error: 'No email on account' }, { status: 400 });

  const limited = await rateLimitByIp(req, `resend-verification:${auth.uid}`, 3, 600);
  if (limited) return NextResponse.json(limited.body, { status: limited.status });

  await sendVerificationEmail(auth.email, auth.email.split('@')[0]);
  return NextResponse.json({ success: true });
}
