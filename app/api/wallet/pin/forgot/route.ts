// app/api/wallet/pin/forgot/route.ts
//
// "Forgot PIN" — step 1. There was previously no path back if a member
// forgot their PIN: /api/wallet/pin/set requires the CURRENT pin to
// change it, which is exactly the thing they don't have. This mints a
// one-time 6-digit code and emails it to the member's registered address.
//
// Deliberately requires an active login session AND a fresh code sent to
// the email on file — being logged in alone isn't enough for a reset,
// since PIN resets are a money-moving control surface (see
// app/api/wallet/pin/reset/route.ts) and a left-open device/session
// shouldn't be sufficient on its own to take it over.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { rateLimitByIp } from '@/lib/rateLimit';
import crypto from 'crypto';

const CODE_TTL_MINUTES = 10;

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Scoped to both this uid and the caller's IP (rateLimitByIp keys by
    // IP within whatever routeName is passed) — ties the limit to the
    // specific account being targeted, not just a shared IP bucket.
    const limited = await rateLimitByIp(req, `pin-forgot:${auth.uid}`, 3, 3600);
    if (limited) return NextResponse.json(limited.body, { status: limited.status });

    const memberRef  = adminDb.collection('members').doc(auth.uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    const member = memberSnap.data()!;

    if (!member.email) return NextResponse.json({ error: 'No email on file — contact support' }, { status: 400 });

    const code = crypto.randomInt(100000, 999999).toString(); // 6 digits, wider than the 4-digit PIN itself since this rides over email, a weaker channel than an in-app PIN pad
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    await memberRef.update({
      pinResetCodeHash: codeHash,
      pinResetExpiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    });

    const sendResult = await sendEmail({
      to: member.email,
      subject: 'Your IBI wallet PIN reset code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <div style="background:#C8102E;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">Reset Your Wallet PIN</h1>
          </div>
          <div style="background:#111318;padding:32px;border-radius:0 0 8px 8px;color:#F5F0E8">
            <p>Dear ${member.displayName ?? 'Member'},</p>
            <p>Use this code to reset your wallet PIN. It expires in ${CODE_TTL_MINUTES} minutes.</p>
            <div style="text-align:center;margin:28px 0">
              <span style="font-family:monospace;font-size:32px;letter-spacing:8px;color:#D4AF37;font-weight:700">${code}</span>
            </div>
            <p style="color:#f87171;font-size:13px"><strong>Didn't request this?</strong> Someone may have access to your account. Change your account password immediately and contact fraud.report@igbobuigbo.org.ng.</p>
          </div>
        </div>`,
    });

    // sendEmailSmart doesn't throw on total failure (see lib/emailRouter.ts
    // — most of its callers treat email as best-effort), so THIS route,
    // where sending the email is the entire point, has to check the
    // result explicitly rather than assume success.
    if (!sendResult.provider) {
      await memberRef.update({ pinResetCodeHash: null, pinResetExpiresAt: null });
      return NextResponse.json({ error: 'Could not send the reset email right now — please try again shortly or contact support.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: `Code sent to ${member.email.replace(/(.{2}).*(@.*)/, '$1***$2')}` });
  } catch (e: any) {
    console.error('[wallet/pin/forgot]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
