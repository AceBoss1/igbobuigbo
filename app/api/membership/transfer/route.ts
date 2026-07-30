// app/api/membership/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendSMS } from '@/lib/termii';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { destRegion, destChapter, effectiveDate, reason, explanation, newAddress } = await req.json();

  if (!destChapter || !effectiveDate || !reason || !explanation) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const existing = await adminDb.collection('transfers')
    .where('uid','==',auth.uid).where('status','==','pending').limit(1).get();
  if (!existing.empty) {
    return NextResponse.json({ error: 'You already have a pending transfer application' }, { status: 409 });
  }

  const memberSnap = await adminDb.collection('members').doc(auth.uid).get();
  const member = memberSnap.data()!;

  if (member.chapter === destChapter) {
    return NextResponse.json({ error: 'You are already in this chapter' }, { status: 400 });
  }

  const ref = `IBI-CHTRF-${Date.now().toString(36).toUpperCase()}`;

  await adminDb.collection('transfers').add({
    uid: auth.uid, ibiNumber: member.ibiNumber,
    fromChapter: member.chapter, fromRegion: member.chapterCode,
    toChapter: destChapter, toRegion: destRegion,
    effectiveDate, reason, explanation, newAddress: newAddress ?? null,
    status: 'pending', ref, createdAt: new Date(),
  });

  const adminsSnap = await adminDb.collection('admins').get();
  if (!adminsSnap.empty) {
    await sendEmail({ to: adminsSnap.docs[0].data().email,
      subject: `Transfer Application — ${member.displayName} (${member.ibiNumber})`,
      html: `<p><strong>${member.displayName}</strong> applied to transfer from <strong>${member.chapter}</strong> to <strong>${destChapter}</strong>.<br/>Reason: ${reason}<br/>Ref: ${ref}</p>`,
    });
  }

  if (member.phone) {
    await sendSMS(member.phone, `IBI: Transfer application submitted (Ref: ${ref}). ${member.chapter} → ${destChapter}. Processing: 5-10 working days. - IBI`);
  }

  return NextResponse.json({ success: true, ref });
}
