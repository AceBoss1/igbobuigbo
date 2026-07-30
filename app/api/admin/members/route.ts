// app/api/admin/members/route.ts
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

    // NO where(), NO orderBy() — plain collection scan, filter in JS
    const snap    = await adminDb.collection('members').limit(500).get();
    const all     = snap.docs.map(d => ({ uid: d.id, ...d.data() })) as any[];

    // Sort by createdAt descending in JS — no index needed
    all.sort((a, b) => {
      const aT = a.createdAt?.seconds ?? a.createdAt?._seconds ?? 0;
      const bT = b.createdAt?.seconds ?? b.createdAt?._seconds ?? 0;
      return bT - aT;
    });

    const pending = all.filter(m => m.status === 'pending');
    const active  = all.filter(m => m.status === 'active' || m.status === 'suspended');

    return NextResponse.json({ pending, active, total: all.length });
  } catch (e: any) {
    console.error('[admin/members]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
