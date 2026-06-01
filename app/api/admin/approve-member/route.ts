// app/api/admin/approve-member/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendSMS } from '@/lib/termii';
import { sendEmail } from '@/lib/brevo';

function generateIBINumber(chapterCode: string): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return `${chapterCode.toUpperCase()}/${digits}`;
}

function generateAffiliateCode(name: string): string {
  const prefix = name.replace(/\s+/g, '').slice(0, 5).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `IBI${prefix}${suffix}`;
}

export async function POST(req: NextRequest) {
  // Verify admin
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
  if (!adminSnap.exists) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { memberUid, action, reason } = await req.json();
  // action: 'approve' | 'reject' | 'suspend'

  if (!memberUid || !action) {
    return NextResponse.json({ error: 'memberUid and action required' }, { status: 400 });
  }

  const memberRef  = adminDb.collection('members').doc(memberUid);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const member = memberSnap.data()!;

  // ─── APPROVE ─────────────────────────────────────────────────────
  if (action === 'approve') {
    if (member.status === 'active') {
      return NextResponse.json({ error: 'Member is already active' }, { status: 409 });
    }

    // Derive chapter code from chapter name (e.g. Lagos → LAG)
    const chapterCode = member.chapter
      ? member.chapter.replace(/diaspora\s*[-–]\s*/i, 'DIA-').slice(0, 3).toUpperCase()
      : 'IBI';

    const ibiNumber      = generateIBINumber(chapterCode);
    const affiliateCode  = generateAffiliateCode(member.displayName ?? 'Member');
    const now            = new Date();

    // Expiry: 1 year for non-lifetime, null for lifetime
    const expiresAt = member.membershipTier === 'lifetime'
      ? null
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();

    const updates = {
      status:        'active',
      ibiNumber,
      chapterCode,
      affiliateCode,
      walletBalance: member.walletBalance ?? 0,
      approvedAt:    now,
      approvedBy:    auth.uid,
      expiresAt,
    };

    await memberRef.update(updates);

    // Log admin action
    await adminDb.collection('adminLogs').add({
      action:     'approve_member',
      targetUid:  memberUid,
      adminUid:   auth.uid,
      ibiNumber,
      createdAt:  now,
    });

    // Referral commission if they were referred
    if (member.referralCode) {
      const refSnap = await adminDb.collection('members')
        .where('affiliateCode', '==', member.referralCode)
        .limit(1)
        .get();

      if (!refSnap.empty) {
        const referrer = refSnap.docs[0];
        const commissions: Record<string, number> = { associate: 500, full: 1500, lifetime: 5000 };
        const commission = commissions[member.membershipTier] ?? 500;

        const referrerData = referrer.data();
        await referrer.ref.update({
          walletBalance: (referrerData.walletBalance ?? 0) + commission,
        });

        // Referral record
        await adminDb.collection('referrals').add({
          referrerUid:  referrer.id,
          refereeUid:   memberUid,
          name:         member.displayName,
          ibiNumber,
          tier:         member.membershipTier,
          commission,
          status:       'active',
          joinedAt:     now,
        });

        // Affiliate stats update
        const affStatsSnap = await adminDb.collection('affiliateStats').where('uid', '==', referrer.id).limit(1).get();
        if (affStatsSnap.empty) {
          await adminDb.collection('affiliateStats').add({ uid: referrer.id, referrals: 1, earnings: commission });
        } else {
          const d = affStatsSnap.docs[0].data();
          await affStatsSnap.docs[0].ref.update({ referrals: d.referrals + 1, earnings: d.earnings + commission });
        }

        // Notify referrer
        if (referrerData.phone) {
          await sendSMS(referrerData.phone, `IBI: Your referral ${member.displayName} has been approved! ₦${commission.toLocaleString()} credited to your IBI Wallet. Keep sharing! - IBI`);
        }
      }
    }

    // Notify member via SMS + Email
    await Promise.allSettled([
      member.phone && sendSMS(member.phone,
        `Welcome to IBI! Your membership has been approved. Your IBI Number: ${ibiNumber}. Login at igbobuigbo.org.ng to access your dashboard. - Igbobuigbo`
      ),
      member.email && sendEmail({
        to:      member.email,
        subject: `Welcome to IBI — Your Member Number: ${ibiNumber}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #C8102E; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 28px;">Welcome to IBI!</h1>
            </div>
            <div style="background: #111318; padding: 32px; border-radius: 0 0 8px 8px; color: #F5F0E8;">
              <p>Dear <strong>${member.displayName}</strong>,</p>
              <p>Your IBI membership application has been <strong style="color: #D4AF37;">approved!</strong></p>
              <div style="background: #16191F; border: 1px solid #D4AF37; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
                <p style="color: #A8A29E; margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Your IBI Number</p>
                <p style="font-size: 28px; font-weight: 900; color: #D4AF37; margin: 0; font-family: monospace;">${ibiNumber}</p>
              </div>
              <p><strong>Tier:</strong> ${member.membershipTier}</p>
              <p><strong>Chapter:</strong> ${member.chapter}</p>
              <p><strong>Affiliate Code:</strong> ${affiliateCode}</p>
              ${expiresAt ? `<p><strong>Expires:</strong> ${new Date(expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : '<p><strong>Membership:</strong> Lifetime</p>'}
              <div style="margin-top: 32px; text-align: center;">
                <a href="https://igbobuigbo.org.ng/dashboard/overview" style="background: #C8102E; color: #fff; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Access Your Dashboard →
                </a>
              </div>
              <p style="color: #6B7280; font-size: 12px; margin-top: 32px; text-align: center;">
                Igbobuigbo.org.ng — Igbo Business Union International<br/>
                14 Zik Avenue, Awka, Anambra State, Nigeria
              </p>
            </div>
          </div>
        `,
      }),
    ]);

    return NextResponse.json({
      success: true,
      ibiNumber,
      affiliateCode,
      message: `Member ${member.displayName} approved with IBI number ${ibiNumber}`,
    });
  }

  // ─── REJECT ───────────────────────────────────────────────────────
  if (action === 'reject') {
    await memberRef.update({ status: 'rejected', rejectedAt: new Date(), rejectedBy: auth.uid, rejectionReason: reason ?? 'Application did not meet requirements' });

    await adminDb.collection('adminLogs').add({ action: 'reject_member', targetUid: memberUid, adminUid: auth.uid, reason, createdAt: new Date() });

    await Promise.allSettled([
      member.phone && sendSMS(member.phone, `IBI: We regret to inform you that your membership application has not been approved at this time. Reason: ${reason ?? 'Requirements not met'}. Contact info@igbobuigbo.org.ng for clarification. - IBI`),
      member.email && sendEmail({
        to:      member.email,
        subject: 'IBI Membership Application — Update',
        html:    `<p>Dear ${member.displayName},</p><p>Unfortunately your IBI membership application was not approved. Reason: <strong>${reason ?? 'Requirements not met'}</strong>.</p><p>Please contact <a href="mailto:info@igbobuigbo.org.ng">info@igbobuigbo.org.ng</a> for further assistance.</p>`,
      }),
    ]);

    return NextResponse.json({ success: true, message: 'Member rejected and notified.' });
  }

  // ─── SUSPEND ─────────────────────────────────────────────────────
  if (action === 'suspend') {
    await memberRef.update({ status: 'suspended', suspendedAt: new Date(), suspendedBy: auth.uid, suspensionReason: reason ?? 'Policy violation' });

    await adminDb.collection('adminLogs').add({ action: 'suspend_member', targetUid: memberUid, adminUid: auth.uid, reason, createdAt: new Date() });

    await Promise.allSettled([
      member.phone && sendSMS(member.phone, `IBI: Your membership (${member.ibiNumber}) has been suspended. Reason: ${reason ?? 'Policy violation'}. Contact info@igbobuigbo.org.ng immediately. - IBI`),
    ]);

    return NextResponse.json({ success: true, message: 'Member suspended and notified.' });
  }

  return NextResponse.json({ error: 'Invalid action. Use: approve, reject, or suspend.' }, { status: 400 });
}
