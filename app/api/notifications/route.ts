// app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Two queries (audience='all' OR targetUid=uid) merged client-side of
  // this route — Firestore doesn't support OR across different fields in
  // one query. Both are simple single-equality queries, no composite
  // index needed.
  const [allSnap, ownSnap] = await Promise.all([
    adminDb.collection('notifications').where('audience', '==', 'all').limit(50).get(),
    adminDb.collection('notifications').where('audience', '==', 'user').where('targetUid', '==', auth.uid).limit(50).get(),
  ]);

  const items = [...allSnap.docs, ...ownSnap.docs]
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        body: data.body,
        link: data.link ?? null,
        type: data.type ?? 'system',
        read: Array.isArray(data.readBy) && data.readBy.includes(auth.uid),
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, 50);

  const unreadCount = items.filter(n => !n.read).length;
  return NextResponse.json({ items, unreadCount });
}
