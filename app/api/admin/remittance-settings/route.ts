// app/api/admin/remittance-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { getRemittanceSettings } from '@/lib/orgWallets';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getRemittanceSettings());
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
  if (!adminSnap.exists || adminSnap.data()?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
  }

  const { chapterToRegionPct, regionToNationalPct } = await req.json();
  if (
    typeof chapterToRegionPct !== 'number' || chapterToRegionPct < 0 || chapterToRegionPct > 100 ||
    typeof regionToNationalPct !== 'number' || regionToNationalPct < 0 || regionToNationalPct > 100
  ) {
    return NextResponse.json({ error: 'Both percentages must be numbers between 0 and 100' }, { status: 400 });
  }

  await adminDb.collection('settings').doc('remittance').set({ chapterToRegionPct, regionToNationalPct, updatedAt: new Date(), updatedBy: auth.uid });

  await adminDb.collection('adminLogs').add({
    action: 'update_remittance_settings', adminUid: auth.uid,
    chapterToRegionPct, regionToNationalPct, createdAt: new Date(),
  });

  return NextResponse.json({ success: true });
}
