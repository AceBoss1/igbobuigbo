// app/api/admin/transfers/route.ts
//
// Chapter/region transfer applications were being written to the
// 'transfers' collection (see app/api/membership/transfer/route.ts) but
// there was no admin-facing route or UI to read that collection at all —
// applications could be submitted successfully and just sit there forever
// with no way for an admin to see, approve, or reject them. This is that
// missing read side; see /api/admin/approve-transfer for the write side.
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
    if (!adminSnap.exists) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    // NO where()/orderBy() on the collection scan itself — filter/sort in
    // JS, same reasoning as /api/admin/members: avoids composite index
    // requirements on a collection that may not have one deployed yet.
    const snap = await adminDb.collection('transfers').limit(500).get();
    const all  = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    all.sort((a, b) => {
      const aT = a.createdAt?.seconds ?? a.createdAt?._seconds ?? 0;
      const bT = b.createdAt?.seconds ?? b.createdAt?._seconds ?? 0;
      return bT - aT;
    });

    const pending = all.filter(t => t.status === 'pending');
    const resolved = all.filter(t => t.status !== 'pending');

    return NextResponse.json({ pending, resolved, total: all.length });
  } catch (e: any) {
    console.error('[admin/transfers]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
