// app/api/membership/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { sendSMS } from '@/lib/termii';
import { sendEmail } from '@/lib/brevo';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    firstName, lastName, email, phone, gender, dob,
    chapter, tier, trade, referralCode, nin, password,
    state, lga, paystackRef,
  } = body;

  // Basic validation
  if (!firstName || !lastName || !email || !phone || !chapter || !tier || !paystackRef) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify Paystack payment
  const payment = await verifyPaystackTransaction(paystackRef);
  if (!payment.status) {
    return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
  }

  // Check for duplicate email
  const existing = await adminDb.collection('members').where('email', '==', email).limit(1).get();
  if (!existing.empty) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  // Create Firebase Auth user
  let uid: string;
  try {
    const userRecord = await adminAuth.createUser({ email, password, displayName: `${firstName} ${lastName}` });
    uid = userRecord.uid;
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    throw e;
  }

  // Save member document (status: pending — awaits admin approval)
  await adminDb.collection('members').doc(uid).set({
    uid,
    email,
    phone,
    displayName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    gender,
    dob,
    state,
    lga,
    chapter,
    membershipTier: tier,
    trade,
    referralCode:   referralCode ?? null,
    nin:            nin ?? null,
    status:         'pending',
    walletBalance:  0,
    ibiNumber:      null,
    affiliateCode:  null,
    chapterCode:    null,
    paystackRef,
    paymentAmount:  payment.amount / 100,
    joinedAt:       new Date().toISOString(),
    createdAt:      new Date(),
  });

  // Notify admins
  const adminsSnap = await adminDb.collection('admins').get();
  const adminEmails = adminsSnap.docs.map(d => d.data().email).filter(Boolean);
  if (adminEmails.length > 0) {
    await sendEmail({
      to:      adminEmails[0],
      subject: `New IBI Membership Application — ${firstName} ${lastName}`,
      html:    `<h2>New Application</h2><p><strong>${firstName} ${lastName}</strong> (${email}) has applied for <strong>${tier}</strong> membership in the <strong>${chapter}</strong> chapter.</p><p>Payment confirmed: ₦${(payment.amount / 100).toLocaleString()}</p><p><a href="https://igbobuigbo.org.ng/admin/members/${uid}">Review Application →</a></p>`,
    });
  }

  // Notify applicant
  await Promise.allSettled([
    sendSMS(phone, `Thank you ${firstName}! Your IBI membership application has been received and is under review. You'll receive your IBI Number via SMS and email once approved. - Igbobuigbo`),
    sendEmail({
      to:      email,
      subject: 'IBI Membership Application Received',
      html:    `<h2>Application Received!</h2><p>Dear ${firstName},</p><p>Your IBI membership application (${tier}) for the <strong>${chapter}</strong> chapter has been received. Our team will review it within 24–48 hours.</p><p>Payment: ₦${(payment.amount / 100).toLocaleString()} — Confirmed ✓</p><p>We'll contact you via email and SMS once approved.</p>`,
    }),
  ]);

  return NextResponse.json({ success: true, message: 'Application submitted. Awaiting admin review.' });
}
