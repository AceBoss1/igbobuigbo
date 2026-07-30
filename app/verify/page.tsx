// app/verify/page.tsx
import type { Metadata }  from 'next';
import { adminDb }        from '@/lib/firebase-admin';
import { createHmac }     from 'crypto';
import Link               from 'next/link';
import { NATIONAL_CODE, getOrCreateOrgWalletSet } from '@/lib/orgWallets';
import { REGIONS, regionWalletCode, getAllChapters, chapterCode } from '@/lib/chapters-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title:       'Document Verification — Igbo Bu Igbo',
  description: 'Verify IBI receipts, ID cards, wallet statements, parcels and official documents.',
};

type RefType = 'transaction' | 'member' | 'statement' | 'parcel' | 'card' | 'upgrade' | 'affiliate' | 'admin' | 'chapterTransfer' | 'donation' | 'orgWalletTx' | 'orgWallet' | 'unknown';

interface VerifiedResult  { ok:true;  type:RefType; label:string; photo?:string|null; fields:{k:string;v:string}[]; note?:string; }
interface FailedResult    { ok:false; type:RefType; label:string; message:string; }
type VerifyResult = VerifiedResult | FailedResult;

// ─── Ref type detection ───────────────────────────────────────────────────────
function detectType(ref: string): RefType {
  const r = ref.toUpperCase();
  if (/^IBI-STMT-/.test(r))                        return 'statement';
  if (/^IBI-CHTRF-/.test(r))                       return 'chapterTransfer'; // chapter/region membership transfer — must be checked before the general IBI-TRF-/TRF- wallet-transfer match below, since it also starts with "TRF" once the IBI- prefix is stripped
  if (/^IBI-DON-WLT-/.test(r))                     return 'donation';   // wallet-funded donation — must be checked before IBI-WLT- below, since it also contains "WLT"
  if (/^IBI-DON-/.test(r))                         return 'donation';   // paystack-funded donation
  if (/^ORGWLT-/.test(r))                          return 'orgWalletTx'; // admin manual credit to a national/regional/chapter purse wallet
  if (/^IBI-UPG-/.test(r))                         return 'upgrade';    // wallet & Paystack upgrades
  if (/^IBI-AFF-/.test(r))                         return 'affiliate';  // affiliate transactions
  if (/^ADMIN-/.test(r))                            return 'admin';      // admin credits
  if (/^IBI-TRF-|^TRF-|^IBI-WLT-|^IBI-CARD-/.test(r)) return 'transaction';
  if (/^IBI-WYB-/.test(r))                         return 'parcel';
  if (/^CARD-/.test(r))                            return 'card';
  if (/^[A-Z]{2,8}\/\d{10}$/.test(r))             return 'member';
  return 'unknown';
}

function recomputeAuthKey(uid: string, ibiNumber: string, from: string, to: string): string {
  return createHmac('sha256', uid)
    .update(`${ibiNumber}:${from}:${to}`)
    .digest('hex').slice(0, 24).toUpperCase();
}

function fmtDate8(s: string): string {
  if (s.length !== 8) return s;
  try { return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`).toLocaleDateString('en-NG',{ day:'numeric', month:'long', year:'numeric' }); }
  catch { return s; }
}

// ─── Verifiers ────────────────────────────────────────────────────────────────

async function verifyTransaction(ref: string): Promise<VerifyResult> {
  try {
    const snap = await adminDb.collection('transactions').where('ref','==',ref).limit(1).get();
    if (snap.empty) return { ok:false, type:'transaction', label:'Transaction Receipt', message:`No transaction found with reference "${ref}".` };
    const d  = snap.docs[0].data();
    const dt = d.createdAt?.toDate?.()?.toLocaleString('en-NG',{ weekday:'short', day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }) ?? '—';
    return {
      ok:true, type:'transaction', label:'Transaction Receipt',
      fields:[
        { k:'Reference',   v:ref },
        { k:'Type',        v:d.type==='credit' ? 'Credit (Money In)' : 'Debit (Money Out)' },
        { k:'Amount',      v:`NGN ${Number(d.amount??0).toLocaleString('en-NG',{minimumFractionDigits:2})}` },
        { k:'Description', v:d.description ?? '—' },
        { k:'Date & Time', v:dt },
        { k:'Status',      v:'Completed ✓' },
      ],
      note:'Party names and balances are not disclosed for privacy.',
    };
  } catch { return { ok:false, type:'transaction', label:'Transaction Receipt', message:'Verification service temporarily unavailable.' }; }
}

async function verifyUpgrade(ref: string): Promise<VerifyResult> {
  try {
    const snap = await adminDb.collection('memberUpgrades').where('reference','==',ref).limit(1).get();
    if (snap.empty) {
      // Also check transactions (wallet upgrade creates a tx record)
      return verifyTransaction(ref);
    }
    const d  = snap.docs[0].data();
    const dt = d.createdAt?.toDate?.()?.toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) ?? '—';
    const LABELS: Record<string,string> = { professional:'Professional', business:'Business', diaspora:'Diaspora', patron:'Patron' };
    return {
      ok:true, type:'upgrade', label:'Membership Upgrade',
      fields:[
        { k:'Reference',  v:ref },
        { k:'IBI Number', v:d.ibiNumber ?? '—' },
        { k:'Upgraded From', v:d.fromTier ?? '—' },
        { k:'Upgraded To',   v:LABELS[d.toTier] ?? d.toTier ?? '—' },
        { k:'Method',     v:d.method === 'wallet' ? 'IBI Wallet' : 'Card / Bank' },
        { k:'Date',       v:dt },
        { k:'Status',     v:'Confirmed ✓' },
      ],
    };
  } catch { return { ok:false, type:'upgrade', label:'Membership Upgrade', message:'Verification temporarily unavailable.' }; }
}

async function verifyAffiliate(ref: string): Promise<VerifyResult> {
  try {
    const snap = await adminDb.collection('transactions').where('ref','==',ref).limit(1).get();
    if (snap.empty) return { ok:false, type:'affiliate', label:'Affiliate Transaction', message:`No affiliate transaction found with reference "${ref}".` };
    const d  = snap.docs[0].data();
    const dt = d.createdAt?.toDate?.()?.toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) ?? '—';
    return {
      ok:true, type:'affiliate', label:'Affiliate Commission',
      fields:[
        { k:'Reference', v:ref },
        { k:'Type',      v:'Affiliate Commission Credit' },
        { k:'Amount',    v:`NGN ${Number(d.amount??0).toLocaleString('en-NG',{minimumFractionDigits:2})}` },
        { k:'Date',      v:dt },
        { k:'Status',    v:'Credited ✓' },
      ],
    };
  } catch { return { ok:false, type:'affiliate', label:'Affiliate Transaction', message:'Verification temporarily unavailable.' }; }
}

async function verifyAdmin(ref: string): Promise<VerifyResult> {
  try {
    const snap = await adminDb.collection('transactions').where('ref','==',ref).limit(1).get();
    if (snap.empty) return { ok:false, type:'admin', label:'Admin Transaction', message:`No admin transaction found with reference "${ref}".` };
    const d  = snap.docs[0].data();
    const dt = d.createdAt?.toDate?.()?.toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) ?? '—';
    return {
      ok:true, type:'admin', label:'Admin Credit / Adjustment',
      fields:[
        { k:'Reference',   v:ref },
        { k:'Type',        v:d.type==='credit' ? 'Admin Credit' : 'Admin Debit' },
        { k:'Amount',      v:`NGN ${Number(d.amount??0).toLocaleString('en-NG',{minimumFractionDigits:2})}` },
        { k:'Description', v:d.description ?? 'Admin Adjustment' },
        { k:'Date',        v:dt },
        { k:'Status',      v:'Processed ✓' },
        { k:'Authority',   v:'IBI Platform Administration' },
      ],
    };
  } catch { return { ok:false, type:'admin', label:'Admin Transaction', message:'Verification temporarily unavailable.' }; }
}

async function verifyChapterTransfer(ref: string): Promise<VerifyResult> {
  try {
    const snap = await adminDb.collection('transfers').where('ref','==',ref).limit(1).get();
    if (snap.empty) return { ok:false, type:'chapterTransfer', label:'Chapter Transfer', message:`No chapter transfer application found with reference "${ref}".` };
    const d  = snap.docs[0].data();
    const dt = d.createdAt?.toDate?.()?.toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) ?? '—';
    const status = String(d.status ?? 'pending').toLowerCase();
    const STATUS_LABEL: Record<string,string> = { pending:'Pending Review', approved:'Approved ✓', rejected:'Rejected', processing:'Processing' };
    return {
      ok:true, type:'chapterTransfer', label:'Chapter / Region Transfer',
      fields:[
        { k:'Reference',       v:ref },
        { k:'IBI Number',      v:d.ibiNumber ?? '—' },
        { k:'From Chapter',    v:d.fromChapter ?? '—' },
        { k:'To Chapter',      v:d.toChapter ?? '—' },
        { k:'Effective Date',  v:d.effectiveDate ?? '—' },
        { k:'Applied',         v:dt },
        { k:'Status',          v:STATUS_LABEL[status] ?? status },
      ],
      note:'Reason and explanation are not disclosed for privacy.',
    };
  } catch { return { ok:false, type:'chapterTransfer', label:'Chapter / Region Transfer', message:'Verification temporarily unavailable.' }; }
}

async function verifyDonation(ref: string): Promise<VerifyResult> {
  try {
    const snap = await adminDb.collection('donations').where('reference', '==', ref).limit(1).get();
    if (snap.empty) return { ok:false, type:'donation', label:'Donation', message:`No donation found with reference "${ref}".` };
    const d = snap.docs[0].data();
    const dt = d.createdAt?.toDate?.()?.toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) ?? '—';
    return {
      ok:true, type:'donation', label:'Donation',
      fields:[
        { k:'Reference',  v:ref },
        { k:'Amount',     v:`₦${(d.amount ?? 0).toLocaleString()}` },
        { k:'Cause',      v:d.cause ?? '—' },
        { k:'Chapter Credited', v:d.chapterName ?? 'National Purse' },
        { k:'Method',     v:d.method === 'wallet' ? 'IBI Wallet' : 'Paystack' },
        { k:'Date',       v:dt },
      ],
      note:'Donor identity is not disclosed for privacy.',
    };
  } catch { return { ok:false, type:'donation', label:'Donation', message:'Verification temporarily unavailable.' }; }
}

async function verifyOrgWalletTx(ref: string): Promise<VerifyResult> {
  try {
    const snap = await adminDb.collection('orgWalletTransactions').where('ref', '==', ref).limit(1).get();
    if (snap.empty) return { ok:false, type:'orgWalletTx', label:'Purse Wallet Transaction', message:`No transaction found with reference "${ref}".` };
    const d = snap.docs[0].data();
    const dt = d.createdAt?.toDate?.()?.toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) ?? '—';
    return {
      ok:true, type:'orgWalletTx', label:'Purse Wallet Transaction',
      fields:[
        { k:'Reference',  v:ref },
        { k:'Wallet',     v:d.address ?? '—' },
        { k:'Amount',     v:`₦${(d.amount ?? 0).toLocaleString()}` },
        { k:'Description', v:d.description ?? '—' },
        { k:'Date',       v:dt },
      ],
    };
  } catch { return { ok:false, type:'orgWalletTx', label:'Purse Wallet Transaction', message:'Verification temporarily unavailable.' }; }
}

/** National/regional/chapter purse wallet addresses (e.g. "ANA/0000000001") use the exact same shape as a member's IBI Number (letters/slash/10 digits) — see lib/orgWallets.ts. verifyMember() tries the members collection first; this is the fallback when that comes back empty, so a wallet address doesn't just show as a "member not found" dead end. */
async function verifyOrgWallet(address: string): Promise<VerifyResult> {
  try {
    const [codeRaw, suffix] = address.toUpperCase().split('/');

    let scope: 'chapter' | 'region' | 'national' | null = null;
    let scopeCode = '';
    let scopeName = '';

    if (codeRaw === NATIONAL_CODE) {
      scope = 'national'; scopeCode = NATIONAL_CODE; scopeName = 'IBI National Purse';
    } else {
      const region = REGIONS.find(r => regionWalletCode(r.id) === codeRaw);
      if (region) {
        scope = 'region'; scopeCode = codeRaw; scopeName = region.label;
      } else {
        const chapter = getAllChapters().find(c => chapterCode(c.value) === codeRaw);
        if (chapter) { scope = 'chapter'; scopeCode = codeRaw; scopeName = `${chapter.value} Chapter`; }
      }
    }

    // Only a code we can positively match against the real, static list
    // of chapters/regions/national gets here — never an arbitrary guess,
    // so this can't be abused to spam-create garbage wallet docs.
    if (!scope) return { ok:false, type:'orgWallet', label:'Purse Wallet', message:`No member or wallet found for "${address}".` };

    const kind = suffix === '0000000001' ? 'main' : suffix === '0000000002' ? 'donation' : suffix === '0000000003' ? 'grant' : null;
    if (!kind || (kind === 'grant' && scope !== 'national')) {
      return { ok:false, type:'orgWallet', label:'Purse Wallet', message:`No member or wallet found for "${address}".` };
    }

    // Auto-provision if this is the first time anyone has looked this
    // wallet up — a wallet that legitimately exists but hasn't received
    // its first transaction yet should read as "exists, ₦0 so far," not
    // "not found," which is indistinguishable from never having existed
    // at all. getOrCreateOrgWalletSet no-ops if it's already there.
    await getOrCreateOrgWalletSet(scope, scopeCode, scopeName);

    const snap = await adminDb.collection('orgWallets').doc(`${scope}_${scopeCode}_${kind}`).get();
    const d = snap.data()!;

    return {
      ok:true, type:'orgWallet', label:'Purse Wallet',
      fields:[
        { k:'Address',  v:d.address ?? address },
        { k:'Belongs To', v:d.scopeName ?? scopeName },
        { k:'Purse Type', v:kind === 'main' ? 'Main Purse' : kind === 'grant' ? 'Grants' : 'Donations' },
        { k:'Total Received', v:`₦${(d.totalReceived ?? 0).toLocaleString()}` },
      ],
      note:'Live spendable balance is not disclosed publicly — the figure above is cumulative funds received to date.',
    };
  } catch { return { ok:false, type:'orgWallet', label:'Purse Wallet', message:'Verification temporarily unavailable.' }; }
}

async function verifyMemberOrOrgWallet(ref: string): Promise<VerifyResult> {
  const memberResult = await verifyMember(ref);
  if (memberResult.ok) return memberResult;
  return verifyOrgWallet(ref);
}

async function verifyMember(ibiNumber: string): Promise<VerifyResult> {
  try {
    const snap = await adminDb.collection('members').where('ibiNumber','==',ibiNumber.toUpperCase()).limit(1).get();
    if (snap.empty) return { ok:false, type:'member', label:'Member Identity', message:`No IBI member found with number "${ibiNumber}".` };
    const d      = snap.docs[0].data();
    const status = String(d.status ?? 'unknown').toLowerCase();
    const since  = d.joinedAt ? new Date(d.joinedAt).toLocaleDateString('en-NG',{month:'long',year:'numeric'}) : '—';
    const expires = d.expiresAt ? new Date(d.expiresAt).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : 'Lifetime';
    return {
      ok:true, type:'member', label:'Member Identity',
      photo: d.photoURL ?? null,
      fields:[
        { k:'Full Name',       v:d.displayName ?? '—' },
        { k:'IBI Number',      v:d.ibiNumber ?? ibiNumber },
        { k:'Chapter',         v:d.chapter ?? '—' },
        { k:'Region',          v:d.region ?? '—' },
        { k:'Membership Tier', v:d.membershipTier ?? '—' },
        { k:'Status',          v:status==='active' ? 'Active ✓' : status.charAt(0).toUpperCase()+status.slice(1) },
        { k:'Member Since',    v:since },
        { k:'Valid Until',     v:expires },
      ],
    };
  } catch { return { ok:false, type:'member', label:'Member Identity', message:'Verification temporarily unavailable.' }; }
}

async function verifyStatement(ref: string, key: string): Promise<VerifyResult> {
  const inner = ref.replace(/^IBI-STMT-/i, '');
  const match = inner.match(/^([A-Z]{2,8})-(\d{10})_(\d{8})-(\d{8})$/i);
  if (!match) return { ok:false, type:'statement', label:'Wallet Statement', message:`Statement reference format not recognised: "${ref}"` };
  const [, chapter, digits, fromRaw, toRaw] = match;
  const ibiNumber = `${chapter.toUpperCase()}/${digits}`;
  let uid = '', memberName = '—';
  try {
    const snap = await adminDb.collection('members').where('ibiNumber','==',ibiNumber).limit(1).get();
    if (!snap.empty) { uid = snap.docs[0].id; memberName = snap.docs[0].data().displayName ?? '—'; }
  } catch {}
  if (!uid) return { ok:false, type:'statement', label:'Wallet Statement', message:`No member found with IBI number ${ibiNumber}.` };
  const from     = `${fromRaw.slice(0,4)}-${fromRaw.slice(4,6)}-${fromRaw.slice(6,8)}`;
  const to       = `${toRaw.slice(0,4)}-${toRaw.slice(4,6)}-${toRaw.slice(6,8)}`;
  const expected = recomputeAuthKey(uid, ibiNumber, from, to);
  if (!key || key.toUpperCase() !== expected) return { ok:false, type:'statement', label:'Wallet Statement', message:'Auth Key mismatch. This statement may have been tampered with or is fraudulent.' };
  return {
    ok:true, type:'statement', label:'Wallet Statement',
    fields:[
      { k:'Statement ID',  v:ref },
      { k:'Member',        v:`${memberName} (${ibiNumber})` },
      { k:'Period From',   v:fmtDate8(fromRaw) },
      { k:'Period To',     v:fmtDate8(toRaw) },
      { k:'Auth Key',      v:expected },
      { k:'Issued By',     v:'Igbo Bu Igbo Platform' },
      { k:'Status',        v:'Authenticated ✓' },
    ],
    note:'Cryptographically authenticated. The Auth Key cannot be forged without IBI member records.',
  };
}

async function verifyCard(ref: string): Promise<VerifyResult> {
  try {
    for (const col of ['transactions','cardOrders']) {
      const field = col === 'cardOrders' ? 'reference' : 'ref';
      const snap  = await adminDb.collection(col).where(field,'==',ref).limit(1).get();
      if (!snap.empty) {
        const d  = snap.docs[0].data();
        const dt = d.createdAt?.toDate?.()?.toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) ?? '—';
        return {
          ok:true, type:'card', label:'IBI Card',
          fields:[
            { k:'Reference', v:ref },
            { k:'Card',      v:d.description ?? `IBI ${(d.cardType??'').toUpperCase()} — ${d.cardTier ?? 'virtual'}` },
            { k:'Date',      v:dt },
            { k:'Status',    v:d.status ? `${d.status.charAt(0).toUpperCase()+d.status.slice(1)} ✓` : 'Issued ✓' },
          ],
        };
      }
    }
    return { ok:false, type:'card', label:'IBI Card', message:`No card record found with reference "${ref}".` };
  } catch { return { ok:false, type:'card', label:'IBI Card', message:'Card verification temporarily unavailable.' }; }
}

async function verifyParcel(ref: string): Promise<VerifyResult> {
  try {
    for (const col of ['parcels','logistics']) {
      const snap = await adminDb.collection(col).where('parcelId','==',ref.toUpperCase()).limit(1).get();
      if (!snap.empty) {
        const d = snap.docs[0].data();
        return {
          ok:true, type:'parcel', label:'Delivery Parcel',
          fields:[
            { k:'Parcel ID',   v:ref },
            { k:'Status',      v:d.status ?? 'In Transit' },
            { k:'Origin',      v:d.origin ?? '—' },
            { k:'Destination', v:d.destination ?? '—' },
            { k:'Last Update', v:d.updatedAt?.toDate?.()?.toLocaleDateString('en-NG') ?? '—' },
          ],
        };
      }
    }
    return { ok:false, type:'parcel', label:'Delivery Parcel', message:`No parcel found with tracking number "${ref}".` };
  } catch { return { ok:false, type:'parcel', label:'Delivery Parcel', message:'Parcel tracking temporarily unavailable.' }; }
}

async function lookupRef(ref: string, key: string): Promise<VerifyResult> {
  switch (detectType(ref)) {
    case 'statement':       return verifyStatement(ref, key);
    case 'chapterTransfer': return verifyChapterTransfer(ref);
    case 'donation':        return verifyDonation(ref);
    case 'orgWalletTx':     return verifyOrgWalletTx(ref);
    case 'upgrade':         return verifyUpgrade(ref);
    case 'affiliate':       return verifyAffiliate(ref);
    case 'admin':           return verifyAdmin(ref);
    case 'transaction':     return verifyTransaction(ref);
    case 'member':          return verifyMemberOrOrgWallet(ref);
    case 'card':            return verifyCard(ref);
    case 'parcel':          return verifyParcel(ref);
    default:
      return { ok:false, type:'unknown', label:'Document', message:'Unrecognised reference format. Please check the document and try again.' };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function VerifyPage({ searchParams }: { searchParams:{ ref?:string; key?:string } }) {
  const rawRef = (searchParams?.ref ?? '').trim();
  const rawKey = (searchParams?.key ?? '').trim().toUpperCase();
  const result = rawRef ? await lookupRef(rawRef, rawKey) : null;

  const typeIcon: Record<RefType,string> = {
    transaction:'💳', member:'🎖', statement:'📄', parcel:'📦',
    card:'💳', upgrade:'⬆️', affiliate:'🔗', admin:'🛠', chapterTransfer:'🔁',
    donation:'❤️', orgWalletTx:'🏦', orgWallet:'🏦', unknown:'❓',
  };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#0a0a0a 0%,#1a0505 50%,#0a0a0a 100%)', display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 16px 80px', fontFamily:"'Helvetica Neue',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:40 }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,#C8102E,#8B1A1A)', border:'3px solid #D4AF37', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', overflow:'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://res.cloudinary.com/djj49cetb/image/upload/v1782343533/logo_rbsnrr.png" alt="IBI" width={72} height={72} style={{ objectFit:'cover', width:'100%', height:'100%' }} />
        </div>
        <h1 style={{ margin:0, color:'#ffffff', fontSize:'clamp(1.4rem,4vw,2rem)', fontWeight:800, letterSpacing:1 }}>IGBO BU IGBO</h1>
        <p style={{ margin:'4px 0 0', color:'#D4AF37', fontSize:'0.78rem', letterSpacing:'0.15em' }}>DOCUMENT VERIFICATION PORTAL</p>
      </div>

      {/* Search form */}
      <div style={{ width:'100%', maxWidth:560, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(212,175,55,0.25)', borderRadius:16, padding:'24px 24px 20px', marginBottom:24 }}>
        <p style={{ color:'#a1a1aa', fontSize:'0.83rem', margin:'0 0 16px', textAlign:'center', lineHeight:1.6 }}>
          Enter any IBI reference — transaction, member ID, wallet statement, upgrade, affiliate, parcel, or card.
        </p>
        <form action="/verify" method="GET">
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            <input name="ref" defaultValue={rawRef} placeholder="e.g. TRF-XXXXX  or  ANA/3847291056  or  IBI-UPG-WLT-..." autoComplete="off" style={{ flex:1, padding:'11px 13px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(212,175,55,0.3)', borderRadius:8, color:'#ffffff', fontSize:'0.83rem', fontFamily:'monospace', outline:'none' }} />
            <button type="submit" style={{ padding:'11px 18px', flexShrink:0, background:'linear-gradient(135deg,#C8102E,#8B1A1A)', border:'none', borderRadius:8, color:'#ffffff', fontWeight:700, fontSize:'0.88rem', cursor:'pointer' }}>
              Verify →
            </button>
          </div>
          <input name="key" defaultValue={rawKey} placeholder="Auth Key (for wallet statements only)" style={{ width:'100%', padding:'9px 13px', boxSizing:'border-box', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#9ca3af', fontSize:'0.78rem', fontFamily:'monospace', outline:'none' }} />
        </form>
      </div>

      {/* Result */}
      {result && (
        <div style={{ width:'100%', maxWidth:560 }}>
          {result.ok ? (
            <div style={{ background:'rgba(22,101,52,0.12)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ background:'rgba(22,101,52,0.4)', padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ fontSize:28 }}>✅</div>
                <div>
                  <div style={{ color:'#4ade80', fontWeight:800, fontSize:'1rem', letterSpacing:0.5 }}>VERIFIED</div>
                  <div style={{ color:'#86efac', fontSize:'0.8rem' }}>{typeIcon[result.type]} {result.label} — Authentic IBI Document</div>
                </div>
              </div>

              {result.type === 'member' && (result as VerifiedResult).photo && (
                <div style={{ display:'flex', justifyContent:'center', padding:'20px 20px 0' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={(result as VerifiedResult).photo!} alt="Member" style={{ width:96, height:96, borderRadius:'50%', objectFit:'cover', border:'3px solid #D4AF37', boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }} />
                </div>
              )}

              <div style={{ padding:'8px 20px 16px' }}>
                {(result as VerifiedResult).fields.map((f, i) => (
                  <div key={f.k} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'10px 0', borderBottom: i < (result as VerifiedResult).fields.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none', gap:16 }}>
                    <span style={{ color:'#71717a', fontSize:'0.78rem', fontWeight:600, minWidth:110, flexShrink:0 }}>{f.k}</span>
                    <span style={{ color: f.k==='Status'||f.k==='Auth Key' ? '#4ade80' : '#e4e4e7', fontSize:'0.8rem', textAlign:'right', wordBreak:'break-all', fontFamily:['IBI Number','Reference','Statement ID','Auth Key'].includes(f.k) ? 'monospace' : 'inherit' }}>{f.v}</span>
                  </div>
                ))}
              </div>
              {(result as VerifiedResult).note && (
                <div style={{ margin:'0 20px 16px', padding:'10px 12px', background:'rgba(212,175,55,0.07)', border:'1px solid rgba(212,175,55,0.18)', borderRadius:8, color:'#a16207', fontSize:'0.73rem', lineHeight:1.6 }}>
                  ℹ️ {(result as VerifiedResult).note}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background:'rgba(153,27,27,0.12)', border:'1px solid rgba(200,16,46,0.3)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ background:'rgba(153,27,27,0.4)', padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ fontSize:28 }}>❌</div>
                <div>
                  <div style={{ color:'#fca5a5', fontWeight:800, fontSize:'1rem' }}>NOT VERIFIED</div>
                  <div style={{ color:'#fca5a5', fontSize:'0.8rem', opacity:0.8 }}>{typeIcon[(result as FailedResult).type]} {(result as FailedResult).label}</div>
                </div>
              </div>
              <div style={{ padding:'18px 20px', color:'#fca5a5', fontSize:'0.83rem', lineHeight:1.65 }}>{(result as FailedResult).message}</div>
            </div>
          )}
        </div>
      )}

      {/* Help tiles */}
      {!result && (
        <div style={{ width:'100%', maxWidth:560, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { icon:'💳', title:'Transaction / Top-Up',  desc:'Wallet transfers, top-ups, card payments', ex:'TRF-xxx / IBI-WLT-xxx' },
            { icon:'🔁', title:'Chapter Transfer',       desc:'Chapter/region membership transfer application', ex:'IBI-CHTRF-...' },
            { icon:'❤️', title:'Donation',               desc:'Wallet or Paystack donation to a cause or chapter', ex:'IBI-DON-... / IBI-DON-WLT-...' },
            { icon:'🏦', title:'Purse Wallet',            desc:'National/regional/chapter purse wallet or its transactions', ex:'ANA/0000000001 · ORGWLT-...' },
            { icon:'🎖', title:'Member ID Card',         desc:'Confirm member identity, chapter & status', ex:'ANA/3847291056' },
            { icon:'📄', title:'Wallet Statement',       desc:'Authenticate a financial statement + Auth Key', ex:'IBI-STMT-OTH-...' },
            { icon:'⬆️', title:'Membership Upgrade',    desc:'Verify a tier upgrade transaction', ex:'IBI-UPG-WLT-...' },
            { icon:'🔗', title:'Affiliate Commission',   desc:'Affiliate earning or seed transaction', ex:'IBI-AFF-...' },
            { icon:'🛠', title:'Admin Credit / Adjust', desc:'Platform admin credit or bonus', ex:'ADMIN-...' },
            { icon:'📦', title:'Delivery Parcel',       desc:'Track an IBI logistics shipment', ex:'IBI-WYB-...' },
            { icon:'💳', title:'IBI Card Order',        desc:'Card issuance or order record', ex:'CARD-...' },
          ].map(c => (
            <div key={c.title} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:16 }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{c.icon}</div>
              <div style={{ color:'#e4e4e7', fontWeight:600, fontSize:'0.82rem', marginBottom:4 }}>{c.title}</div>
              <div style={{ color:'#71717a', fontSize:'0.71rem', lineHeight:1.4, marginBottom:8 }}>{c.desc}</div>
              <div style={{ color:'#D4AF37', fontSize:'0.67rem', fontFamily:'monospace' }}>{c.ex}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop:48, textAlign:'center' }}>
        <p style={{ color:'#3f3f46', fontSize:'0.71rem', margin:'0 0 6px' }}>Operated by the Igbo Bu Igbo Unity &amp; Cultural Preservation Initiative.</p>
        <p style={{ color:'#3f3f46', fontSize:'0.71rem', margin:0 }}>
          <Link href="/" style={{ color:'#52525b' }}>igbobuigbo.org.ng</Link>{' · '}
          <Link href="/contact" style={{ color:'#52525b' }}>Contact Secretariat</Link>{' · '}
          <Link href="/dashboard/overview" style={{ color:'#52525b' }}>Member Login</Link>
        </p>
      </div>
    </div>
  );
}
