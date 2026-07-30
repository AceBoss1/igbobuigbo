// app/api/admin/approve-member/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { getPricingSettingsServer } from '@/lib/pricing-server';
import { atomicCredit } from '@/lib/wallet';

function generateIBINumber(chapterCode: string): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return `${chapterCode.toUpperCase()}/${digits}`;
}

function generateAffiliateCode(name: string): string {
  const prefix = name.replace(/\s+/g,'').slice(0,5).toUpperCase().replace(/[^A-Z]/g,'X');
  const suffix = Math.random().toString(36).slice(2,7).toUpperCase();
  return `IBI${prefix}${suffix}`;
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
  if (!adminSnap.exists) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { memberUid, action, reason } = await req.json();
  if (!memberUid || !action) return NextResponse.json({ error: 'memberUid and action required' }, { status: 400 });

  const memberRef  = adminDb.collection('members').doc(memberUid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const member = memberSnap.data()!;

  if (action === 'approve') {
    if (member.status === 'active') return NextResponse.json({ error: 'Already active' }, { status: 409 });

    const ibiNumber     = generateIBINumber(member.chapterCode ?? 'IBI');
    const affiliateCode = generateAffiliateCode(member.displayName ?? 'Member');
    const now           = new Date();

    await memberRef.update({
      status: 'active', ibiNumber, affiliateCode,
      approvedAt: now, approvedBy: auth.uid,
    });

    await adminDb.collection('adminLogs').add({
      action:'approve_member', targetUid:memberUid,
      adminUid:auth.uid, ibiNumber, createdAt:now,
    });

    // Referral commission for paid tiers — computed from the SAME
    // admin-configurable settings/pricing doc used sitewide (lib/pricing.ts),
    // so this always matches the fee that was actually charged, no separate
    // hardcoded commission table to fall out of sync.
    if (member.referralCode && member.membershipTier !== 'student' && member.membershipTier !== 'youth') {
      const { registrationFees, commissionRate } = await getPricingSettingsServer();
      const feeForTier: Record<string, number> = {
        professional: registrationFees.professional,
        business:     registrationFees.business,
        diaspora:     0, // diaspora is USD — commission handled via conversion elsewhere, not wallet credit here
        patron:       registrationFees.patron,
      };
      const commission = Math.round((feeForTier[member.membershipTier] ?? 0) * commissionRate);
      if (commission > 0) {
        const refSnap = await adminDb.collection('members')
          .where('affiliateCode','==',member.referralCode).limit(1).get();
        if (!refSnap.empty) {
          const referrer = refSnap.docs[0];
          const result = await atomicCredit(referrer.id, commission, {
            description: `Affiliate Commission — ${member.displayName}`,
            ref: `AFF-${memberUid.slice(0,8)}`,
          });
          await adminDb.collection('referrals').add({
            referrerUid:referrer.id, refereeUid:memberUid,
            name:member.displayName, ibiNumber, tier:member.membershipTier,
            commission, status:'active', joinedAt:now,
          });
        }
      }
    }

    // Email notification
    try {
      await sendEmail({
        to: member.email,
        subject: `✅ IBI Membership Approved — Your Number: ${ibiNumber}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#C8102E;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0">Welcome to Igbo Bu Igbo!</h1>
          </div>
          <div style="background:#111318;padding:32px;border-radius:0 0 8px 8px;color:#F5F0E8">
            <p>Dear <strong>${member.displayName}</strong>, your <strong>${member.membershipTier}</strong> membership has been <strong style="color:#4ade80">APPROVED</strong>!</p>
            <div style="background:#16191F;border:1px solid #D4AF37;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
              <p style="color:#A8A29E;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em">Your IBI Number</p>
              <p style="font-size:28px;font-weight:900;color:#D4AF37;margin:0;font-family:monospace">${ibiNumber}</p>
            </div>
            <p><strong>Affiliate Code:</strong> <code style="color:#D4AF37">${affiliateCode}</code></p>
            <p><strong>Your referral link:</strong><br/><a href="https://igbobuigbo.org.ng/membership?ref=${affiliateCode}" style="color:#D4AF37">igbobuigbo.org.ng/membership?ref=${affiliateCode}</a></p>
            <div style="margin-top:32px;text-align:center">
              <a href="https://igbobuigbo.org.ng/login" style="background:#C8102E;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">Access Dashboard →</a>
            </div>
          </div>
        </div>`,
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success:true, ibiNumber, affiliateCode });
  }

  if (action === 'reject') {
    await memberRef.update({ status:'rejected', rejectedAt:new Date(), rejectedBy:auth.uid, rejectionReason:reason??'Requirements not met' });
    try {
      await sendEmail({ to:member.email, subject:'IBI Membership Application Update',
        html:`<p>Dear ${member.displayName},</p><p>Your application was not approved. Reason: ${reason??'Requirements not met'}.</p><p>Contact <a href="mailto:info@igbobuigbo.org.ng">info@igbobuigbo.org.ng</a> for clarification.</p>` });
    } catch { /* non-critical */ }
    return NextResponse.json({ success:true, message:'Rejected' });
  }

  if (action === 'suspend') {
    await memberRef.update({ status:'suspended', suspendedAt:new Date(), suspendedBy:auth.uid, suspensionReason:reason });
    return NextResponse.json({ success:true, message:'Suspended' });
  }

  return NextResponse.json({ error:'Invalid action' }, { status:400 });
}
