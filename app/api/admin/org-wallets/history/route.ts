// app/api/admin/org-wallets/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
  if (!adminSnap.exists) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const walletDocId = req.nextUrl.searchParams.get('walletDocId');
  if (!walletDocId) return NextResponse.json({ error: 'walletDocId required' }, { status: 400 });

  try {
    // No orderBy in the query itself — sort in JS, same convention used
    // everywhere else in this codebase to avoid needing a composite index
    // deployed for every new query shape.
    const snap = await adminDb.collection('orgWalletTransactions')
      .where('walletDocId', '==', walletDocId).limit(200).get();

    const txs = snap.docs.map(d => d.data());
    txs.sort((a, b) => {
      const aT = a.createdAt?.seconds ?? a.createdAt?._seconds ?? 0;
      const bT = b.createdAt?.seconds ?? b.createdAt?._seconds ?? 0;
      return bT - aT;
    });

    return NextResponse.json({ transactions: txs });
  } catch (e: any) {
    console.error('[admin/org-wallets/history]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
