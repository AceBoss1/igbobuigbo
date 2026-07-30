// app/api/admin/org-wallets/credit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { creditOrgWallet, regionCode } from '@/lib/orgWallets';
import { REGIONS } from '@/lib/chapters-data';

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
  if (!adminSnap.exists || adminSnap.data()?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
  }

  const { scope, scopeCode, kind, amount, description } = await req.json();
  if (!scope || !scopeCode || !kind || !amount || amount <= 0) {
    return NextResponse.json({ error: 'scope, scopeCode, kind, and a positive amount are required' }, { status: 400 });
  }
  if (!['chapter', 'region', 'national'].includes(scope)) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  if (!['main', 'donation', 'grant'].includes(kind))       return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });

  let scopeName = scopeCode;
  if (scope === 'national') scopeName = 'IBI National Purse';
  if (scope === 'region') {
    const r = REGIONS.find(r => regionCode(r.id) === scopeCode);
    if (r) scopeName = r.label;
  }
  // scope === 'chapter': scopeCode is already the resolved 3-letter code
  // from the caller (admin UI passes chapterWalletCode(chapterName)), so
  // scopeName just stays as the code itself if a friendlier label wasn't
  // resolvable server-side — acceptable, it's a display label only.

  try {
    const result = await creditOrgWallet(scope, scopeCode, scopeName, kind, amount, {
      description: description ?? `Manual credit by admin`,
      ref: `ORGWLT-${Date.now()}`,
    });

    await adminDb.collection('adminLogs').add({
      action: 'credit_org_wallet', adminUid: auth.uid,
      scope, scopeCode, kind, amount, address: result.address,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error('[admin/org-wallets/credit]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
