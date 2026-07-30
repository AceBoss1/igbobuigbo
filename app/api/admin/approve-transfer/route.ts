// app/api/admin/approve-transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { sendSMS } from '@/lib/termii';
import { chapterCode } from '@/lib/chapters-data';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Regular admin is sufficient here (not superadmin) — chapter transfer
  // approval doesn't move money, same tier of action as member approval,
  // PND, and card restriction.
  const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
  if (!adminSnap.exists) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const { transferId, action, reason } = await req.json();
  if (!transferId || !action) return NextResponse.json({ error: 'transferId and action required' }, { status: 400 });

  const transferRef  = adminDb.collection('transfers').doc(transferId);
  const transferSnap = await transferRef.get();
  if (!transferSnap.exists) return NextResponse.json({ error: 'Transfer application not found' }, { status: 404 });
  const transfer = transferSnap.data()!;

  if (transfer.status !== 'pending') {
    return NextResponse.json({ error: `Already ${transfer.status}` }, { status: 409 });
  }

  const memberRef  = adminDb.collection('members').doc(transfer.uid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  const member = memberSnap.data()!;

  if (action === 'approve') {
    const now = new Date();

    // The member's IBI Number is deliberately left untouched — "Your IBI
    // number and history are fully preserved" is the promise made on the
    // transfer application form itself. Only the member's chapter fields
    // move; chapterCode() is the same single-source-of-truth helper used
    // at registration, so a member who transfers ends up with an
    // identical chapterCode to someone who registered fresh into that
    // chapter.
    await memberRef.update({
      chapter:     transfer.toChapter,
      chapterCode: chapterCode(transfer.toChapter),
    });

    await transferRef.update({
      status: 'approved', approvedAt: now, approvedBy: auth.uid,
    });

    await adminDb.collection('adminLogs').add({
      action: 'approve_transfer', targetUid: transfer.uid,
      adminUid: auth.uid, transferRef: transfer.ref,
      fromChapter: transfer.fromChapter, toChapter: transfer.toChapter,
      createdAt: now,
    });

    try {
      await sendEmail({
        to: member.email,
        subject: `✅ Chapter Transfer Approved — ${transfer.fromChapter} → ${transfer.toChapter}`,
        html: `<p>Dear ${member.displayName},</p><p>Your chapter transfer application (Ref: ${transfer.ref}) has been <strong style="color:#4ade80">APPROVED</strong>.</p><p>You are now a member of the <strong>${transfer.toChapter}</strong> chapter, effective ${transfer.effectiveDate}.</p><p>Your IBI number and full membership history remain unchanged.</p>`,
      });
    } catch { /* non-critical */ }

    if (member.phone) {
      try {
        await sendSMS(member.phone, `IBI: Your transfer to ${transfer.toChapter} has been APPROVED (Ref: ${transfer.ref}), effective ${transfer.effectiveDate}. - IBI`);
      } catch { /* non-critical */ }
    }

    // Bell notification — email/SMS are easy to miss, this is what shows
    // up in-app immediately next time the member is on the platform.
    try {
      await createNotification({
        title: '✅ Chapter Transfer Approved',
        body:  `Your transfer to ${transfer.toChapter} is approved, effective ${transfer.effectiveDate}.`,
        link:  '/dashboard/transfer',
        type:  'transaction',
        audience: 'user',
        targetUid: transfer.uid,
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, message: 'Transfer approved' });
  }

  if (action === 'reject') {
    await transferRef.update({
      status: 'rejected', rejectedAt: new Date(), rejectedBy: auth.uid,
      rejectionReason: reason ?? 'Not specified',
    });

    try {
      await sendEmail({
        to: member.email,
        subject: `Chapter Transfer Application Update — ${transfer.ref}`,
        html: `<p>Dear ${member.displayName},</p><p>Your chapter transfer application (Ref: ${transfer.ref}, ${transfer.fromChapter} → ${transfer.toChapter}) was not approved.</p><p>Reason: ${reason ?? 'Not specified'}.</p><p>Contact <a href="mailto:finance@igbobuigbo.org.ng">finance@igbobuigbo.org.ng</a> for clarification, or submit a new application.</p>`,
      });
    } catch { /* non-critical */ }

    try {
      await createNotification({
        title: 'Chapter Transfer Not Approved',
        body:  `Your transfer application to ${transfer.toChapter} (Ref: ${transfer.ref}) was not approved.${reason ? ` Reason: ${reason}` : ''}`,
        link:  '/dashboard/transfer',
        type:  'transaction',
        audience: 'user',
        targetUid: transfer.uid,
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, message: 'Transfer rejected' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
