// lib/orgWallets.ts
//
// National, regional, and chapter "purse" wallets — distinct from member
// wallets (lib/wallet.ts). Every scope gets a "main" purse (dues,
// registration fees, remittances) and a "donation" purse (gifts). The
// NATIONAL scope additionally gets a THIRD wallet, "grant"
// (IBI/0000000003) — grants are applied for and received at the national
// level only; regions and chapters never apply for or hold grant funds
// independently. When grant money needs to reach a region or chapter,
// that's a supervised transfer OUT of the national grant wallet into
// that scope's ordinary main purse — not a grant wallet of its own. (That
// transfer mechanism is Phase 2, same as auto-remittance — this just
// establishes where grant funds live in the meantime.)
//
// Address format: {CODE}/0000000001 (main), {CODE}/0000000002 (donation),
// and for national only, IBI/0000000003 (grant) — deterministic, not
// random like member IBI numbers.
//
// Firestore doc IDs can't contain "/", so the canonical slash-formatted
// address is stored as a FIELD (`address`), not the doc ID — the doc ID
// is a safe `{scope}_{code}_{kind}` key instead. Always look wallets up
// by scope+code+kind (walletDocId below), not by parsing the address
// string.
//
// SCOPE: superadmin-managed for now (credit/debit via
// /api/admin/org-wallets/*). Multi-signatory approval (3 excos per
// chapter/region, 3 national-president-appointed signatories for the
// national purse) and the monthly auto-remittance cron are intentionally
// NOT built yet — see TECH_DEBT_AND_ROADMAP.md "Org Wallets — Phase 2".
import { adminDb } from '@/lib/firebase-admin';
import { chapterCode, regionWalletCode, getAllChapters, type RegionId } from '@/lib/chapters-data';

export type OrgWalletScope = 'chapter' | 'region' | 'national';
export type OrgWalletKind  = 'main' | 'donation' | 'grant';

export interface OrgWallet {
  address:       string;          // e.g. "ANA/0000000001"
  scope:         OrgWalletScope;
  scopeCode:     string;          // e.g. "ANA", "ISS", "IBI"
  scopeName:     string;          // human label, e.g. "Anambra State Chapter"
  kind:          OrgWalletKind;
  balance:       number;          // Naira, LIVE spendable balance — never shown publicly, see verifyOrgWallet in app/verify/page.tsx
  totalReceived: number;          // Naira, cumulative total ever credited — only ever increases, even across future debits/remittances (Phase 2). Safe to show publicly: real transparency without exposing current cash-on-hand.
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

export const NATIONAL_CODE = 'IBI';

const KIND_SUFFIX: Record<OrgWalletKind, string> = {
  main: '0000000001', donation: '0000000002', grant: '0000000003',
};

function walletDocId(scope: OrgWalletScope, scopeCode: string, kind: OrgWalletKind) {
  return `${scope}_${scopeCode}_${kind}`;
}

function walletAddress(scopeCode: string, kind: OrgWalletKind) {
  return `${scopeCode}/${KIND_SUFFIX[kind]}`;
}

/** Chapter name ("Anambra State") → its 3-letter wallet code. Thin wrapper for callers that don't want to import chapters-data directly. */
export function chapterWalletCode(chapterName: string): string {
  return chapterCode(chapterName);
}
export function regionCode(regionId: RegionId): string {
  return regionWalletCode(regionId);
}

/**
 * Ensures a scope's wallet set exists, creating whichever are missing.
 * National gets main + donation + grant (three wallets); region and
 * chapter get main + donation only (two) — grants don't exist at those
 * scopes. This is what "donations or dues from a chapter or region
 * instantly generates the needed wallet set if not already existing"
 * means in practice — called at the point money is about to be credited,
 * not on a separate provisioning step.
 */
export async function getOrCreateOrgWalletSet(
  scope: OrgWalletScope, scopeCode: string, scopeName: string,
): Promise<{ main: string; donation: string; grant?: string }> {
  const kinds: OrgWalletKind[] = scope === 'national' ? ['main', 'donation', 'grant'] : ['main', 'donation'];
  await Promise.all(kinds.map(async (kind) => {
    const ref = adminDb.collection('orgWallets').doc(walletDocId(scope, scopeCode, kind));
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        address: walletAddress(scopeCode, kind), scope, scopeCode, scopeName, kind,
        balance: 0, totalReceived: 0, createdAt: new Date(),
      } as OrgWallet);
    }
  }));
  return {
    main: walletAddress(scopeCode, 'main'),
    donation: walletAddress(scopeCode, 'donation'),
    ...(scope === 'national' ? { grant: walletAddress(scopeCode, 'grant') } : {}),
  };
}

/** Atomically credits one wallet by scope+code+kind, creating its wallet set first if needed. Returns the new balance. */
export async function creditOrgWallet(
  scope: OrgWalletScope, scopeCode: string, scopeName: string, kind: OrgWalletKind,
  amount: number, meta: { description: string; ref: string },
): Promise<{ address: string; newBalance: number }> {
  if (amount <= 0) throw new Error('Amount must be positive');
  if (kind === 'grant' && scope !== 'national') {
    // Enforced here, not just in the UI/API layer — grants only ever
    // exist at the national scope, by design, not by current omission.
    throw new Error('Grant wallets only exist at the national level — regions and chapters do not apply for grants independently.');
  }
  await getOrCreateOrgWalletSet(scope, scopeCode, scopeName);

  const ref = adminDb.collection('orgWallets').doc(walletDocId(scope, scopeCode, kind));
  const newBalance = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data()?.balance ?? 0;
    const currentTotal = snap.data()?.totalReceived ?? 0;
    const next = current + amount;
    tx.update(ref, { balance: next, totalReceived: currentTotal + amount });
    tx.set(adminDb.collection('orgWalletTransactions').doc(), {
      walletDocId: ref.id, address: snap.data()?.address, amount,
      description: meta.description, ref: meta.ref, createdAt: new Date(),
    });
    return next;
  });

  return { address: walletAddress(scopeCode, kind), newBalance };
}

export interface RemittanceSettings {
  chapterToRegionPct:  number; // default 20 — % of each chapter main-purse wallet remitted to its region monthly
  regionToNationalPct: number; // default 25 — % of each region main-purse wallet remitted to national monthly
}
const DEFAULT_REMITTANCE: RemittanceSettings = { chapterToRegionPct: 20, regionToNationalPct: 25 };

/** Reads settings/remittance, falling back to defaults if unset — mirrors the pattern in lib/pricing-server.ts. The actual scheduled transfer job that CONSUMES these percentages is Phase 2 (see TECH_DEBT_AND_ROADMAP.md); this just makes the numbers configurable and ready ahead of that. */
export async function getRemittanceSettings(): Promise<RemittanceSettings> {
  const snap = await adminDb.collection('settings').doc('remittance').get();
  if (!snap.exists) return DEFAULT_REMITTANCE;
  const d = snap.data()!;
  return {
    chapterToRegionPct:  typeof d.chapterToRegionPct  === 'number' ? d.chapterToRegionPct  : DEFAULT_REMITTANCE.chapterToRegionPct,
    regionToNationalPct: typeof d.regionToNationalPct === 'number' ? d.regionToNationalPct : DEFAULT_REMITTANCE.regionToNationalPct,
  };
}

/** Best-effort chapter match against free-text (e.g. a donation's optional message field) — used as a fallback when the donor didn't use the explicit chapter selector. Case-insensitive substring match against known chapter names; returns null on no confident match. */
export function matchChapterFromText(text: string): { name: string; code: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const chapters = getAllChapters();
  const hit = chapters.find(c => lower.includes(c.value.toLowerCase()) || lower.includes(c.value.replace(' State','').toLowerCase()));
  return hit ? { name: hit.value, code: chapterCode(hit.value) } : null;
}
