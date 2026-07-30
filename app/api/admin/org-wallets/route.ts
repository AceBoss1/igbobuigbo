// app/api/admin/org-wallets/route.ts
//
// Read-side for national/regional/chapter purse wallets. National and
// regional sets are small and fixed (1 + 3 scopes), so this always
// returns them (creating on first read if they don't exist yet — cheap,
// and means the admin panel never shows a confusing "not found" for
// something that just hasn't received its first transaction). Chapter
// wallets are looked up by code on demand instead of listed in bulk,
// since most of the 43 chapters won't have wallets yet until their first
// donation/due (see getOrCreateOrgWalletSet in lib/orgWallets.ts).
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { getOrCreateOrgWalletSet, NATIONAL_CODE, regionCode, getRemittanceSettings } from '@/lib/orgWallets';
import { REGIONS, chapterCode } from '@/lib/chapters-data';

async function requireSuperadmin(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return { ok: false as const, status: 401, error: 'Unauthorized' };
  const snap = await adminDb.collection('admins').doc(auth.uid).get();
  if (!snap.exists || snap.data()?.role !== 'superadmin') {
    return { ok: false as const, status: 403, error: 'Superadmin access required' };
  }
  return { ok: true as const, uid: auth.uid };
}

async function readWalletSet(scope: 'national' | 'region' | 'chapter', code: string, name: string) {
  await getOrCreateOrgWalletSet(scope, code, name);
  const kinds = scope === 'national' ? ['main', 'donation', 'grant'] : ['main', 'donation'];
  const ids = kinds.map(kind => `${scope}_${code}_${kind}`);
  const snaps = await Promise.all(ids.map(id => adminDb.collection('orgWallets').doc(id).get()));
  return snaps.filter(s => s.exists).map(s => ({ walletDocId: s.id, ...s.data() }));
}

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const chapterQuery = req.nextUrl.searchParams.get('chapter'); // chapter NAME, e.g. "Anambra State"

  try {
    if (chapterQuery) {
      const code = chapterCode(chapterQuery);
      const wallets = await readWalletSet('chapter', code, `${chapterQuery} Chapter`);
      return NextResponse.json({ wallets });
    }

    const national = await readWalletSet('national', NATIONAL_CODE, 'IBI National Purse');
    const regional = (await Promise.all(
      REGIONS.map(r => readWalletSet('region', regionCode(r.id), r.label)),
    )).flat();
    const remittance = await getRemittanceSettings();

    return NextResponse.json({ national, regional, remittance });
  } catch (e: any) {
    console.error('[admin/org-wallets]', e);
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
