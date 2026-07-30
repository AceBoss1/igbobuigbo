// app/api/wallet/pin/reset/route.ts
//
// "Forgot PIN" — step 2. Verifies the code emailed by
// app/api/wallet/pin/forgot, then sets the new main PIN. Also clears any
// lockout and — since a PIN reset is exactly the kind of event the real
// owner needs to know happened even if they didn't do it themselves —
// fires an email + bell notification.
//
// Deliberately does NOT touch pin2Hash (duress PIN) here. If a member
// needed to reset their main PIN, they've also lost the ability to prove
// they know it, which set-duress requires — they'll need to re-set the
// duress PIN afterward the normal way (app/api/wallet/pin/set-duress),
// now that they know their new main PIN. Silently carrying over or
// clearing the duress PIN here would be a surprising side effect of an
// action that's supposed to be narrowly scoped to "I forgot my PIN."
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { isValidPinFormat, hashPin } from '@/lib/pin';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { notifyTransaction } from '@/lib/notifications';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, newPin } = await req.json();
    if (!isValidPinFormat(newPin)) return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 });
    if (!code || typeof code !== 'string') return NextResponse.json({ error: 'Reset code required' }, { status: 400 });

    const memberRef  = adminDb.collection('members').doc(auth.uid);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    const member = memberSnap.data()!;

    if (!member.pinResetCodeHash || !member.pinResetExpiresAt) {
      return NextResponse.json({ error: 'No reset in progress — request a code first' }, { status: 400 });
    }
    if (member.pinResetExpiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: 'Code expired — request a new one' }, { status: 400 });
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== member.pinResetCodeHash) {
      return NextResponse.json({ error: 'Incorrect code' }, { status: 400 });
    }

    await memberRef.update({
      pinHash: hashPin(newPin),
      pinSetAt: new Date(),
      pinFailCount: 0,
      pinLockedUntil: null,
      pinResetCodeHash: null,
      pinResetExpiresAt: null,
    });

    // The real owner needs to know this happened even if it wasn't them —
    // if their email/session was the thing actually compromised, this is
    // the tripwire.
    if (member.email) {
      await sendEmail({
        to: member.email,
        subject: 'Your IBI wallet PIN was reset',
        html: `<p>Dear ${member.displayName ?? 'Member'},</p><p>Your wallet PIN was just reset. If this was you, no action is needed.</p><p style="color:#f87171"><strong>If this wasn't you</strong>, your account may be compromised — change your account password immediately and contact fraud.report@igbobuigbo.org.ng.</p>`,
      }).catch(() => {});
    }
    await notifyTransaction(auth.uid, '🔒 Wallet PIN reset', 'Your wallet PIN was just reset. If this wasn\'t you, contact support immediately.', '/dashboard/profile').catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[wallet/pin/reset]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
