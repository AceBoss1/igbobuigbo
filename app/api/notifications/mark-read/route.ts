// app/api/notifications/mark-read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '@/lib/auth-middleware';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { notificationId, all } = await req.json();

  if (all) {
    const [allSnap, ownSnap] = await Promise.all([
      adminDb.collection('notifications').where('audience', '==', 'all').limit(50).get(),
      adminDb.collection('notifications').where('audience', '==', 'user').where('targetUid', '==', auth.uid).limit(50).get(),
    ]);
    const batch = adminDb.batch();
    [...allSnap.docs, ...ownSnap.docs].forEach(d => {
      const readBy = d.data().readBy ?? [];
      if (!readBy.includes(auth.uid)) batch.update(d.ref, { readBy: FieldValue.arrayUnion(auth.uid) });
    });
    await batch.commit();
    return NextResponse.json({ success: true });
  }

  if (!notificationId) return NextResponse.json({ error: 'notificationId required' }, { status: 400 });

  const ref  = adminDb.collection('notifications').doc(notificationId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });

  const data = snap.data()!;
  const visible = data.audience === 'all' || (data.audience === 'user' && data.targetUid === auth.uid);
  if (!visible) return NextResponse.json({ error: 'Not authorized to mark this notification' }, { status: 403 });

  await ref.update({
    readBy: FieldValue.arrayUnion(auth.uid),
  });
  return NextResponse.json({ success: true });
}
