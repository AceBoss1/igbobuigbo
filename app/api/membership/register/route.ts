// app/api/membership/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { sendVerificationEmail } from '@/lib/emailVerification';
import { rateLimitByIp } from '@/lib/rateLimit';
import { chapterCode as deriveChapterCode } from '@/lib/chapters-data';

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateIBINumber(chapterCode: string): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return `${chapterCode.toUpperCase()}/${digits}`;
}

function generateAffiliateCode(name: string): string {
  const prefix = name.replace(/\s+/g, '').slice(0, 5).toUpperCase().replace(/[^A-Z]/g, 'X');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `IBI${prefix}${suffix}`;
}


async function verifyPaystack(reference: string) {
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const data = await res.json();
    return data?.data ?? null;
  } catch { return null; }
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Registration has two free tiers (Student/Youth, ₦0), so there's
    // otherwise zero friction stopping a script from creating unlimited
    // fake accounts — each one costs a welcome email, potentially an SMS,
    // and pollutes the admin pending-approval queue. 5 per IP per hour is
    // generous for a real person registering themselves or a family
    // member, but throttles scripted abuse.
    const limited = await rateLimitByIp(req, 'register', 5, 3600);
    if (limited) return NextResponse.json(limited.body, { status: limited.status });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { firstName, lastName, email, phone, gender, dob,
            chapter, tier, trade, referralCode, nin, password,
            state, paystackRef } = body;

    if (!firstName || !lastName || !email || !chapter || !tier || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const freeTiers    = ['student', 'youth'];
    const isFree       = freeTiers.includes(tier);
    const isFreeRef    = !paystackRef || paystackRef.startsWith('FREE-');

    // Paid tiers require payment verification (skip if Paystack not configured)
    if (!isFree && !isFreeRef) {
      const paystackKey = process.env.PAYSTACK_SECRET_KEY;
      if (paystackKey && paystackKey.startsWith('sk_')) {
        const payment = await verifyPaystack(paystackRef);
        if (!payment || !payment.status) {
          return NextResponse.json({ error: 'Payment not verified. Please try again.' }, { status: 400 });
        }
      }
      // If Paystack not configured yet → allow for now (CAC verification pending)
    }

    // Check duplicate email
    const existing = await adminDb.collection('members').where('email','==',email).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 });
    }

    // Create Firebase Auth user
    let uid: string;
    try {
      const userRecord = await adminAuth.createUser({
        email, password,
        displayName: `${firstName} ${lastName}`,
        emailVerified: false,
      });
      uid = userRecord.uid;
    } catch (e: any) {
      if (e.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'Email already registered. Please sign in.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create account: ' + e.message }, { status: 500 });
    }

    const chapterCode   = deriveChapterCode(chapter);
    const now           = new Date();

    // ── Auto-approve free tiers immediately ─────────────────────────────────
    // Free members get their IBI number, affiliateCode, and active status right away
    // Paid members go to 'pending' until admin approves (or payment verified)
    const autoApprove   = isFree;
    const ibiNumber     = autoApprove ? generateIBINumber(chapterCode) : null;
    const affiliateCode = autoApprove ? generateAffiliateCode(`${firstName}${lastName}`) : null;

    // Lifetime tiers (paid) never expire; student/youth have soft expiry
    const getExpiry = (): string | null => {
      if (isFree) {
        // Student: no fixed date (conceptual — admin can update)
        // Youth: 36 - currentAge years (approximate: 15 years from now as fallback)
        if (tier === 'student') return null;  // expires on graduation — admin manages
        if (tier === 'youth') {
          const dob_date = dob ? new Date(dob) : null;
          if (dob_date) {
            const expiry = new Date(dob_date);
            expiry.setFullYear(expiry.getFullYear() + 36);
            return expiry.toISOString();
          }
          return new Date(now.getFullYear() + 15, now.getMonth(), now.getDate()).toISOString();
        }
      }
      return null; // All paid tiers = lifetime
    };

    const memberData = {
      uid, email,
      phone:          phone ?? '',
      displayName:    `${firstName} ${lastName}`,
      firstName, lastName,
      gender:         gender ?? '',
      dob:            dob ?? '',
      state:          state ?? '',
      chapter,        chapterCode,
      membershipTier: tier,
      trade:          trade ?? '',
      referralCode:   referralCode ?? null,
      nin:            nin ?? null,
      status:         autoApprove ? 'active' : 'pending',
      walletBalance:  0,
      ibiNumber,
      affiliateCode,
      paystackRef:    paystackRef ?? null,
      joinedAt:       now.toISOString(),
      expiresAt:      getExpiry(),
      approvedAt:     autoApprove ? now : null,
      createdAt:      now,
    };

    await adminDb.collection('members').doc(uid).set(memberData);

    // ── Referral commission ──────────────────────────────────────────────────
    if (autoApprove && referralCode) {
      try {
        const refSnap = await adminDb.collection('members')
          .where('affiliateCode','==',referralCode).limit(1).get();
        if (!refSnap.empty) {
          const referrer = refSnap.docs[0];
          const commission = 0; // Free tier referral = ₦0 commission
          if (commission > 0) {
            await referrer.ref.update({
              walletBalance: (referrer.data().walletBalance ?? 0) + commission,
            });
          }
          await adminDb.collection('referrals').add({
            referrerUid: referrer.id, refereeUid: uid,
            name: memberData.displayName, ibiNumber, tier, commission,
            status: 'active', joinedAt: now,
          });
        }
      } catch { /* non-critical */ }
    }

    // ── Notify member ────────────────────────────────────────────────────────
    try {
      if (autoApprove) {
        await sendEmail({
          to: email,
          subject: `Welcome to Igbo Bu Igbo! Your IBI Number: ${ibiNumber}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#C8102E;padding:24px;text-align:center;border-radius:8px 8px 0 0">
                <h1 style="color:#fff;margin:0">Welcome to Igbo Bu Igbo!</h1>
              </div>
              <div style="background:#111318;padding:32px;border-radius:0 0 8px 8px;color:#F5F0E8">
                <p>Dear <strong>${firstName}</strong>,</p>
                <p>Your <strong>${tier}</strong> membership is now <strong style="color:#4ade80">ACTIVE</strong>!</p>
                <div style="background:#16191F;border:1px solid #D4AF37;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
                  <p style="color:#A8A29E;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em">Your IBI Number</p>
                  <p style="font-size:28px;font-weight:900;color:#D4AF37;margin:0;font-family:monospace">${ibiNumber}</p>
                </div>
                <p><strong>Chapter:</strong> ${chapter}</p>
                <p><strong>Affiliate Code:</strong> <code style="color:#D4AF37">${affiliateCode}</code></p>
                <p style="font-size:13px;color:#6B7280">Share your affiliate link to earn commissions:<br/>
                  <a href="https://igbobuigbo.org.ng/membership?ref=${affiliateCode}" style="color:#D4AF37">
                    igbobuigbo.org.ng/membership?ref=${affiliateCode}
                  </a>
                </p>
                <div style="margin-top:32px;text-align:center">
                  <a href="https://igbobuigbo.org.ng/login" style="background:#C8102E;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">
                    Access Your Dashboard →
                  </a>
                </div>
                <p style="color:#6B7280;font-size:12px;margin-top:32px;text-align:center">
                  Igbobuigbo.org.ng · info@igbobuigbo.org.ng · +234 (0) 806 787 1203
                </p>
              </div>
            </div>`,
        });
      } else {
        await sendEmail({
          to: email,
          subject: 'IBI Membership Application Received',
          html: `<p>Dear ${firstName},</p><p>Your <strong>${tier}</strong> membership application for <strong>${chapter}</strong> chapter has been received. We'll review it within 24–48 hours and notify you by email.</p><p>Payment reference: ${paystackRef}</p>`,
        });
      }
    } catch { /* email failure non-critical */ }

    // Notify admins for paid pending members
    if (!autoApprove) {
      try {
        const adminsSnap = await adminDb.collection('admins').get();
        if (!adminsSnap.empty) {
          await sendEmail({
            to: adminsSnap.docs[0].data().email,
            subject: `New Paid Application — ${firstName} ${lastName} (${tier})`,
            html: `<p><strong>${firstName} ${lastName}</strong> (${email}) applied for <strong>${tier}</strong> in <strong>${chapter}</strong>. Payment: ${paystackRef}. <a href="https://igbobuigbo.org.ng/admin">Review in Admin Panel →</a></p>`,
          });
        }
      } catch { /* non-critical */ }
    }

    // ── Email verification (TD-12) ─────────────────────────────────────────
    // Fire-and-forget — should never block or fail registration itself.
    sendVerificationEmail(email, firstName).catch(() => {});

    return NextResponse.json({
      success: true,
      status:  autoApprove ? 'active' : 'pending',
      ibiNumber,
      affiliateCode,
      message: autoApprove
        ? `Welcome! Your IBI number is ${ibiNumber}. Check your email.`
        : 'Application submitted. Awaiting admin review.',
    });

  } catch (e: any) {
    console.error('[register]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
