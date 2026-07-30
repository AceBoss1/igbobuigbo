// app/dashboard/wallet/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs }        from 'firebase/firestore';
import { db }              from '@/lib/firebase';
import { useAuth }         from '@/lib/AuthContext';
import { openPaystack }    from '@/lib/paystack-inline';
import toast               from 'react-hot-toast';
import ReceiptTemplate     from '@/components/wallet/ReceiptTemplate';
import StatementReport     from '@/components/wallet/StatementReport';
import {
  buildReceiptData,
  downloadReceiptPdf,
  fetchLogoDataUrl,
  fetchQrDataUrl,
  resolveParties,
  type WalletTx,
} from '@/lib/receiptUtils';
import type { ReceiptData } from '@/components/wallet/ReceiptTemplate';
import PinGateModal from '@/components/dashboard/PinGateModal';
import PinConfirmModal from '@/components/PinConfirmModal';
import { getClientPinMode, scaleForDisplay, type PinMode } from '@/lib/pinSessionClient';

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

// ─── Recipient info ───────────────────────────────────────────────────────────
interface RecipientInfo {
  name:      string;
  ibiNumber: string;
  chapter:   string;
  status:    string;
  photoURL:  string | null;
}

// ─── Instant receipt modal — NO balance (for recipient) ──────────────────────
function InstantReceiptModal({ data, onUpdate, onClose }: {
  data:     ReceiptData;
  onUpdate: (d: ReceiptData) => void;
  onClose:  () => void;
}) {
  const [busy, setBusy] = useState(false);

  const dl = async () => {
    setBusy(true);
    try { await downloadReceiptPdf('ibi-instant-root', `IBI_Receipt_${data.referenceNo}.pdf`); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.78)',
        zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
        borderRadius:'var(--radius-xl)', overflow:'hidden', width:'100%', maxWidth:520,
        maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)' }}>

        {/* Header */}
        <div style={{ backgroundColor:'#166534', padding:'14px 20px',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:'0.95rem' }}>
              ✓ Transfer Successful
            </div>
            <div style={{ color:'#86efac', fontSize:'0.75rem', marginTop:2 }}>
              Receipt ready — download and share with recipient as proof of payment
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            color:'#fff', fontSize:22, cursor:'pointer', opacity:0.8, padding:'2px 6px' }}>×</button>
        </div>

        {/* Scaled preview */}
        <div style={{ overflowY:'auto', flex:1, background:'#f3f4f6', padding:12 }}>
          <div style={{ transformOrigin:'top left', transform:'scale(0.62)', width:794, pointerEvents:'none' }}>
            <ReceiptTemplate data={data} showBalance={false} />
          </div>
        </div>

        {/* Full-size off-screen element for PDF capture */}
        <div id="ibi-instant-root"
          style={{ position:'fixed', left:-9999, top:-9999, width:794, background:'#fff' }}>
          <ReceiptTemplate data={data} showBalance={false} />
        </div>

        {/* Actions */}
        <div style={{ padding:'14px 20px', display:'flex', gap:10,
          borderTop:'1px solid var(--border-subtle)', flexShrink:0, background:'var(--bg-elevated)' }}>
          <button onClick={dl} disabled={busy} className="btn btn-primary"
            style={{ flex:1, justifyContent:'center', gap:10, fontSize:'0.88rem' }}>
            {busy
              ? <><span className="spinner" style={{ width:14, height:14 }} /> Generating PDF…</>
              : '⬇  Download Receipt PDF'}
          </button>
          <button onClick={onClose} className="btn"
            style={{ flex:1, justifyContent:'center', fontSize:'0.88rem',
              background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History receipt modal — WITH balance ─────────────────────────────────────
// Shown before a transfer executes — every field here mirrors what the
// receipt will show afterward, so there's nothing on the receipt the
// member didn't already see and confirm. If the server flags a possible
// duplicate (same recipient + amount sent moments ago), this same modal
// switches to that warning instead of a second, separate dialog.
function TransferConfirmModal({
  recipient, amount, note, senderName, senderIBI, processing, duplicateWarning,
  onConfirm, onConfirmDuplicate, onCancel,
}: {
  recipient: { name: string; ibiNumber: string; chapter?: string };
  amount: number; note: string; senderName: string; senderIBI: string;
  processing: boolean; duplicateWarning: string | null;
  onConfirm: () => void; onConfirmDuplicate: () => void; onCancel: () => void;
}) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget && !processing) onCancel(); }} style={{
      position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.72)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div style={{
        background:'var(--bg-elevated)', border:'1px solid var(--border-gold)',
        borderRadius:'var(--radius-xl)', width:'100%', maxWidth:420,
        overflow:'hidden', boxShadow:'var(--shadow-lg)',
      }}>
        {duplicateWarning ? (
          <div style={{ padding:'var(--space-xl)' }}>
            <div style={{ fontSize:'2.2rem', textAlign:'center', marginBottom:12 }}>⚠️</div>
            <h3 style={{ textAlign:'center', marginBottom:12 }}>Possible Duplicate Transfer</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'0.9rem', textAlign:'center', lineHeight:1.6, marginBottom:24 }}>
              {duplicateWarning}
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={onCancel} disabled={processing} className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }}>
                Cancel
              </button>
              <button onClick={onConfirmDuplicate} disabled={processing} className="btn btn-gold" style={{ flex:1, justifyContent:'center', gap:8 }}>
                {processing ? <span className="spinner" style={{ width:14, height:14 }} /> : null}
                Yes, Send Again
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', background:'var(--grad-card)' }}>
              <h3 style={{ margin:0, fontSize:'1rem' }}>Confirm Transfer</h3>
              <p style={{ margin:'3px 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>Review before sending — this can't be undone</p>
            </div>

            <div style={{ padding:'var(--space-lg)' }}>
              <div style={{ textAlign:'center', marginBottom:'var(--space-lg)' }}>
                <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>You are sending</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'2.2rem', fontWeight:900, color:'var(--ibi-gold)' }}>
                  ₦{amount.toLocaleString()}
                </div>
              </div>

              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10, marginBottom:'var(--space-lg)' }}>
                <Row label="To" value={`${recipient.name}`} />
                <Row label="Recipient IBI No." value={recipient.ibiNumber} mono />
                {recipient.chapter && <Row label="Chapter" value={recipient.chapter} />}
                <Row label="From" value={`${senderName} (${senderIBI})`} mono />
                {note && <Row label="Note" value={note} />}
              </div>

              <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', textAlign:'center', marginBottom:'var(--space-lg)' }}>
                Confirming means you want this exact transaction to happen.
              </p>

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={onCancel} disabled={processing} className="btn btn-ghost" style={{ flex:1, justifyContent:'center' }}>
                  Cancel
                </button>
                <button onClick={onConfirm} disabled={processing} className="btn btn-gold" style={{ flex:1, justifyContent:'center', gap:8 }}>
                  {processing ? <><span className="spinner" style={{ width:14, height:14 }} /> Sending…</> : 'Confirm & Send'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:12, fontSize:'0.85rem' }}>
      <span style={{ color:'var(--text-muted)' }}>{label}</span>
      <span style={{ color:'var(--text-primary)', fontWeight:600, fontFamily: mono ? 'var(--font-mono)' : undefined, textAlign:'right' }}>{value}</span>
    </div>
  );
}

function HistoryReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const dl = async () => {
    setBusy(true);
    try { await downloadReceiptPdf('ibi-history-root', `IBI_Receipt_${data.referenceNo}.pdf`); }
    finally { setBusy(false); }
  };
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.78)',
        zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-subtle)',
        borderRadius:'var(--radius-xl)', overflow:'hidden', width:'100%', maxWidth:520,
        maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)' }}>

        <div style={{ backgroundColor:'#8B1A1A', padding:'14px 20px',
          display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:'0.95rem' }}>Transaction Receipt</div>
            <div style={{ color:'#D4AF37', fontSize:'0.72rem', marginTop:2, fontFamily:'var(--font-mono)' }}>
              {data.referenceNo}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            color:'#fff', fontSize:22, cursor:'pointer', opacity:0.8, padding:'2px 6px' }}>×</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, background:'#f3f4f6', padding:12 }}>
          <div style={{ transformOrigin:'top left', transform:'scale(0.62)', width:794, pointerEvents:'none' }}>
            <ReceiptTemplate data={data} showBalance={true} />
          </div>
        </div>

        <div id="ibi-history-root"
          style={{ position:'fixed', left:-9999, top:-9999, width:794, background:'#fff' }}>
          <ReceiptTemplate data={data} showBalance={true} />
        </div>

        <div style={{ padding:'14px 20px', display:'flex', gap:10,
          borderTop:'1px solid var(--border-subtle)', flexShrink:0, background:'var(--bg-elevated)' }}>
          <button onClick={dl} disabled={busy} className="btn btn-primary"
            style={{ flex:1, justifyContent:'center', gap:10, fontSize:'0.88rem' }}>
            {busy
              ? <><span className="spinner" style={{ width:14, height:14 }} /> Generating…</>
              : '⬇  Download Receipt PDF'}
          </button>
          <button onClick={onClose} className="btn"
            style={{ flex:1, justifyContent:'center', fontSize:'0.88rem',
              background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const { member, refreshMember } = useAuth();

  // ── PIN gate — required once per session before wallet content shows ──────
  const [pinMode, setPinMode]         = useState<PinMode>(null);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  useEffect(() => {
    const existing = getClientPinMode();
    if (existing) { setPinMode(existing); setPinUnlocked(true); }
  }, []);
  const displayBalance = scaleForDisplay(member?.walletBalance ?? 0, pinMode);

  const [transactions,  setTransactions]  = useState<WalletTx[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState<'history'|'topup'|'transfer'>('history');
  const [processing,    setProcessing]    = useState(false);

  // Top-up
  const [topupPreset,  setTopupPreset]  = useState(5000);
  const [topupCustom,  setTopupCustom]  = useState('');
  const finalAmount = topupCustom ? (parseInt(topupCustom) || 0) : topupPreset;

  // Transfer
  const [transferTo,    setTransferTo]    = useState('');
  const [transferAmt,   setTransferAmt]   = useState('');
  const [transferNote,  setTransferNote]  = useState('');
  const [recipient,     setRecipient]     = useState<RecipientInfo | null>(null);
  const [recipientErr,  setRecipientErr]  = useState('');
  const [lookingUp,     setLookingUp]     = useState(false);
  const lookupTimer                        = useRef<ReturnType<typeof setTimeout>>();

  // Receipts
  const [instantReceipt, setInstantReceipt] = useState<ReceiptData | null>(null);
  const [historyReceipt, setHistoryReceipt] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null);

  // ── Transactions ────────────────────────────────────────────────────────────
  const fetchTxs = useCallback(async () => {
    if (!member || !db) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'transactions'), where('uid', '==', member.uid)),
      );
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as WalletTx[];
      all.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      setTransactions(all.slice(0, 100));
    } finally { setLoading(false); }
  }, [member]);

  useEffect(() => { fetchTxs(); }, [fetchTxs]);

  // ── Recipient lookup (600ms debounce) ────────────────────────────────────
  const IBI_RE = /^[A-Z]{2,8}\/\d{10}$/;

  const lookupRecipient = useCallback(async (ibi: string) => {
    if (!IBI_RE.test(ibi)) { setRecipient(null); setRecipientErr(''); return; }
    setLookingUp(true); setRecipient(null); setRecipientErr('');
    try {
      const res  = await fetch(`/api/wallet/lookup-recipient?ibi=${encodeURIComponent(ibi)}`);
      const data = await res.json();
      if (!res.ok) { setRecipientErr(data.error ?? 'Member not found'); return; }
      if (data.status !== 'active') {
        setRecipientErr(`Member account is ${data.status} — transfer not allowed`);
        return;
      }
      setRecipient(data);
    } catch { setRecipientErr('Lookup failed — check your connection'); }
    finally  { setLookingUp(false); }
  }, []);

  const handleIbiChange = (val: string) => {
    const v = val.toUpperCase();
    setTransferTo(v); setRecipient(null); setRecipientErr('');
    clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => lookupRecipient(v), 600);
  };

  // ── Top-up ──────────────────────────────────────────────────────────────────
  const handleTopup = async () => {
    if (finalAmount < 100) { toast.error('Minimum top-up is ₦100'); return; }
    setProcessing(true);
    const ref = `IBI-WLT-${Date.now()}`;
    try {
      await openPaystack({
        email: member?.email ?? '', amount: finalAmount * 100, ref,
        metadata: { uid: member?.uid, type: 'wallet_topup' },
        onSuccess: async (res: any) => {
          try {
            await fetch('/api/wallet/topup', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ reference: res.reference, amount: finalAmount }),
            });
            toast.success(`₦${finalAmount.toLocaleString()} added to wallet!`);
            await refreshMember(); await fetchTxs();
          } catch { toast.error('Top-up verification failed'); }
          finally { setProcessing(false); }
        },
        onClose: () => setProcessing(false),
      });
    } catch (e: any) { setProcessing(false); toast.error(e.message ?? 'Could not open payment'); }
  };

  // ── Transfer — instant receipt fires IMMEDIATELY, assets load in background ──
  // ── Transfer — review-and-confirm before sending ──────────────────────────
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [duplicateWarning,    setDuplicateWarning]     = useState<string | null>(null);
  // Which transfer action is waiting on a fresh PIN — null when no prompt
  // is showing. PIN is required on every transfer submission, not just
  // once per wallet-page session (server enforces this too — see
  // app/api/wallet/transfer/route.ts).
  const [pinPromptFor, setPinPromptFor] = useState<false | true | null>(null);
  const transferReqIdRef = useRef<string>('');

  const openTransferConfirm = () => {
    if (!recipient)                             { toast.error('Verify recipient first'); return; }
    const amt = parseFloat(transferAmt);
    if (!amt || amt < 100)                      { toast.error('Minimum transfer is ₦100'); return; }
    if (amt > displayBalance)     { toast.error('Insufficient balance'); return; }
    // Fresh id per NEW transfer attempt — stays stable across a network-retry
    // of THIS attempt (see TD-18), so a dropped connection can't double-send.
    transferReqIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    setDuplicateWarning(null);
    setShowTransferConfirm(true);
  };

  const executeTransfer = async (confirmDuplicate = false, pin: string) => {
    if (!recipient) return;
    const amt = parseFloat(transferAmt);

    setProcessing(true);
    try {
      const res  = await fetch('/api/wallet/transfer', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          recipientIbiNumber: recipient.ibiNumber, amount: amt, note: transferNote,
          clientRequestId: transferReqIdRef.current, confirmDuplicate, pin,
        }),
      });
      const json = await res.json();

      // Server thinks this might be a deliberate resubmit of a transfer that
      // already went through moments ago (as opposed to a same-attempt retry,
      // which is handled silently via clientRequestId above) — surface it
      // rather than guessing which the member meant.
      if (res.status === 409 && json.warning === 'possible_duplicate') {
        setDuplicateWarning(json.message);
        setProcessing(false);
        return;
      }

      if (!res.ok) throw new Error(json.error ?? 'Transfer failed');

      toast.success(`₦${amt.toLocaleString()} sent to ${recipient.name}!`);
      setShowTransferConfirm(false);
      setDuplicateWarning(null);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Show receipt modal IMMEDIATELY with data we already have.
      //         Do NOT wait for logo/QR network requests.
      // ─────────────────────────────────────────────────────────────────────
      if (member) {
        const txRef        = json.reference;
        const syntheticTx: WalletTx = {
          id:          txRef,
          type:        'debit',
          amount:      amt,
          description: `Transfer to ${json.recipientName ?? recipient.name} (${json.recipientIbiNumber ?? recipient.ibiNumber})${transferNote ? ' -- ' + transferNote : ''}`,
          ref:         txRef,
          createdAt:   { seconds: Math.floor(Date.now() / 1000) },
          balance:     json.senderBalance ?? Math.max(0, member.walletBalance - amt),
        };
        const { sender, recip } = (() => {
          const parties = resolveParties(syntheticTx, member);
          return { sender: parties.sender, recip: parties.recipient };
        })();

        const baseReceipt: ReceiptData = {
          referenceNo:     txRef,
          transactionType: 'debit',
          description:     syntheticTx.description,
          dateTime:        new Date(),
          amount:          amt,
          currency:        'NGN',
          balanceAfter:    undefined, // hidden — instant receipt for recipient
          sender,
          recipient:       recip,
          logoDataUrl:     null,  // will update when loaded
          qrDataUrl:       undefined,
        };

        // Show modal now
        setInstantReceipt(baseReceipt);

        // STEP 2: Load logo + QR in the background, then update the receipt
        //         data so the PDF has full assets when downloaded.
        ;(async () => {
          try {
            const [logoDataUrl, qrDataUrl] = await Promise.all([
              fetchLogoDataUrl(),
              fetchQrDataUrl(txRef),
            ]);
            setInstantReceipt(prev =>
              prev && prev.referenceNo === txRef
                ? { ...prev, logoDataUrl, qrDataUrl }
                : prev
            );
          } catch {
            // Assets optional — receipt already visible
          }
        })();
      }

      // Reset form + refresh data
      setTransferTo(''); setTransferAmt(''); setTransferNote(''); setRecipient(null);
      await refreshMember(); await fetchTxs();

    } catch (e: any) {
      toast.error(e.message ?? 'Transfer failed');
      throw e;
    } finally { setProcessing(false); }
  };

  // ── History receipt ─────────────────────────────────────────────────────────
  const openHistoryReceipt = async (tx: WalletTx) => {
    if (!member) return;
    // Receipts are official financial records — showing scaled/fake numbers
    // on a downloadable PDF would misrepresent real money movement in a
    // document a member might legitimately need later. Better to simply not
    // offer it here than to fake it. Message stays generic, same reasoning
    // as the transfer duress-cap error: never confirm duress mode is active.
    if (pinMode === 'duress') { toast.error('Receipt unavailable right now'); return; }
    setReceiptLoading(tx.id);
    try {
      const data = await buildReceiptData(tx, member, true);
      setHistoryReceipt(data);
    } catch { toast.error('Could not load receipt'); }
    finally  { setReceiptLoading(null); }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding:'10px 20px', background:'transparent', border:'none',
    borderBottom:`2px solid ${active ? 'var(--ibi-gold)' : 'transparent'}`,
    color: active ? 'var(--ibi-gold)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 400, fontSize:'0.88rem',
    cursor:'pointer', transition:'all 0.2s',
  });

  return (
    <>
      {!pinUnlocked && (
        <PinGateModal onUnlock={(mode) => { setPinMode(mode); setPinUnlocked(true); }} />
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xl)', maxWidth:640 }}>

        {/* Balance card */}
        <div style={{ background:'linear-gradient(135deg,#0d1f0a 0%,#0a1a08 100%)',
          border:'1px solid rgba(74,222,128,0.2)', borderRadius:'var(--radius-xl)',
          padding:'var(--space-xl)', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-30, right:-30, width:180, height:180,
            borderRadius:'50%', background:'radial-gradient(circle,rgba(74,222,128,0.06) 0%,transparent 70%)' }} />
          <div style={{ fontSize:'0.7rem', color:'rgba(74,222,128,0.7)', fontWeight:700,
            letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>IBI Wallet Balance</div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'clamp(2rem,6vw,3rem)', fontWeight:700, color:'#4ade80', marginBottom:4 }}>
            ₦{pinUnlocked ? displayBalance.toLocaleString() : '••••.••'}
          </div>
          <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.4)' }}>
            {member?.ibiNumber} · IBI Wallet
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)',
          border:'1px solid var(--border-subtle)', overflow:'hidden' }}>
          <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)' }}>
            {(['history','topup','transfer'] as const).map(t => (
              <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
                {t === 'history' ? '📋 History' : t === 'topup' ? '➕ Top Up' : '↗️ Transfer'}
              </button>
            ))}
          </div>

          <div style={{ padding:'var(--space-lg)' }}>

            {/* ── HISTORY ───────────────────────────────────────────── */}
            {tab === 'history' && (
              <div>
                {loading ? (
                  <div style={{ textAlign:'center', padding:'var(--space-xl)' }}>
                    <div className="spinner" style={{ margin:'0 auto',
                      borderColor:'var(--border-gold)', borderTopColor:'var(--ibi-gold)' }} />
                  </div>
                ) : transactions.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'var(--space-xl)',
                    color:'var(--text-muted)', fontSize:'0.9rem' }}>
                    No transactions yet. Top up your wallet to get started.
                  </div>
                ) : (
                  <div>
                    {transactions.map((tx, i) => (
                      <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:10,
                        padding:'11px 4px',
                        borderBottom: i < transactions.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0,
                          background: tx.type==='credit' ? 'rgba(74,222,128,0.1)' : 'rgba(200,16,46,0.1)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color: tx.type==='credit' ? '#4ade80' : 'var(--ibi-red-light)',
                          fontWeight:700, fontSize:'1rem' }}>
                          {tx.type === 'credit' ? '↓' : '↑'}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'0.83rem', color:'var(--text-primary)', fontWeight:500,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {tx.description}
                          </div>
                          <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:1 }}>
                            {tx.ref} · {tx.createdAt ? new Date(tx.createdAt.seconds*1000).toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric'}) : ''}
                          </div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.88rem',
                            color: tx.type==='credit' ? '#4ade80' : 'var(--ibi-red-light)' }}>
                            {tx.type==='credit' ? '+' : '-'}₦{scaleForDisplay(tx.amount, pinMode).toLocaleString()}
                          </div>
                          {tx.balance !== undefined && (
                            <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                              Bal: ₦{scaleForDisplay(tx.balance, pinMode).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <button onClick={() => openHistoryReceipt(tx)}
                          disabled={receiptLoading === tx.id}
                          title="Download Receipt"
                          style={{ flexShrink:0, background:'var(--bg-card)', border:'1px solid var(--border-gold)',
                            borderRadius:'var(--radius-sm)', color:'var(--ibi-gold)', fontSize:'0.7rem', fontWeight:600,
                            padding:'4px 9px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, minWidth:34,
                            opacity: receiptLoading===tx.id ? 0.5 : 1 }}>
                          {receiptLoading===tx.id
                            ? <span className="spinner" style={{ width:10, height:10,
                                borderColor:'var(--border-gold)', borderTopColor:'var(--ibi-gold)' }} />
                            : '🧾'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!loading && transactions.length > 0 && member && (
                  <StatementReport transactions={transactions} member={member} />
                )}
              </div>
            )}

            {/* ── TOP UP ────────────────────────────────────────────── */}
            {tab === 'topup' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-lg)' }}>
                <div>
                  <div className="form-label" style={{ marginBottom:10 }}>Quick Amounts</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
                    {PRESETS.map(a => (
                      <button key={a} onClick={() => { setTopupPreset(a); setTopupCustom(''); }} style={{
                        padding:'10px 4px',
                        background: topupPreset===a && !topupCustom ? 'var(--ibi-red)' : 'var(--bg-card)',
                        border:`1px solid ${topupPreset===a && !topupCustom ? 'var(--ibi-red)' : 'var(--border-subtle)'}`,
                        borderRadius:'var(--radius-md)', cursor:'pointer', transition:'all 0.15s',
                        color: topupPreset===a && !topupCustom ? '#fff' : 'var(--text-secondary)',
                        fontWeight:600, fontSize:'0.83rem', fontFamily:'var(--font-mono)',
                      }}>₦{a.toLocaleString()}</button>
                    ))}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Or enter custom amount</label>
                    <input type="number" className="form-input" placeholder="e.g. 7500"
                      value={topupCustom}
                      onChange={e => { setTopupCustom(e.target.value); setTopupPreset(0); }}
                      min={100} />
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'12px 16px', background:'var(--bg-card)',
                  borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)' }}>
                  <span style={{ color:'var(--text-muted)', fontSize:'0.88rem' }}>Amount to add</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'#4ade80', fontSize:'1.1rem' }}>
                    ₦{finalAmount.toLocaleString()}
                  </span>
                </div>
                <button onClick={handleTopup} disabled={processing || finalAmount < 100}
                  className="btn btn-primary" style={{ justifyContent:'center', gap:10 }}>
                  {processing
                    ? <><span className="spinner" style={{ width:16, height:16 }} /> Processing…</>
                    : `Top Up ₦${finalAmount.toLocaleString()} via Paystack`}
                </button>
              </div>
            )}

            {/* ── TRANSFER ──────────────────────────────────────────── */}
            {tab === 'transfer' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>

                {/* IBI Number + live lookup */}
                <div className="form-group">
                  <label className="form-label">Recipient IBI Number</label>
                  <div style={{ position:'relative' }}>
                    <input className="form-input" value={transferTo}
                      onChange={e => handleIbiChange(e.target.value)}
                      placeholder="e.g. ANA/3847291056"
                      style={{ fontFamily:'var(--font-mono)', letterSpacing:'0.05em', paddingRight: lookingUp ? 40 : 14 }} />
                    {lookingUp && (
                      <span className="spinner" style={{ position:'absolute', right:12,
                        top:'50%', transform:'translateY(-50%)', width:14, height:14,
                        borderColor:'var(--border-gold)', borderTopColor:'var(--ibi-gold)' }} />
                    )}
                  </div>
                  <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:4, display:'block' }}>
                    Format: CHAPTER/10DIGITS — found on member's ID card
                  </span>
                </div>

                {/* Recipient confirmed */}
                {recipient && (
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                    background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.3)',
                    borderRadius:'var(--radius-md)' }}>
                    {recipient.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={recipient.photoURL} alt={recipient.name}
                        style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover',
                          border:'2px solid rgba(74,222,128,0.4)', flexShrink:0 }} />
                    ) : (
                      <div style={{ width:44, height:44, borderRadius:'50%', flexShrink:0,
                        background:'rgba(74,222,128,0.15)', display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:'1.1rem' }}>👤</div>
                    )}
                    <div style={{ flex:1 }}>
                      <div style={{ color:'#4ade80', fontWeight:700, fontSize:'0.9rem' }}>
                        ✓ {recipient.name}
                      </div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                        {recipient.ibiNumber} · {recipient.chapter}
                      </div>
                    </div>
                    <div style={{ fontSize:'0.7rem', fontWeight:700, color:'#4ade80',
                      background:'rgba(74,222,128,0.1)', padding:'3px 8px', borderRadius:99 }}>Verified</div>
                  </div>
                )}

                {/* Recipient error */}
                {recipientErr && (
                  <div style={{ padding:'10px 14px', background:'rgba(200,16,46,0.06)',
                    border:'1px solid rgba(200,16,46,0.25)', borderRadius:'var(--radius-md)',
                    color:'var(--ibi-red-light)', fontSize:'0.82rem' }}>
                    ✗ {recipientErr}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Amount (₦)</label>
                  <input type="number" className="form-input" value={transferAmt}
                    onChange={e => setTransferAmt(e.target.value)}
                    placeholder="Enter amount" min={100} disabled={!recipient} />
                  {parseFloat(transferAmt) > displayBalance && (
                    <span className="form-error">
                      Exceeds balance of ₦{displayBalance.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Note <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(optional)</span>
                  </label>
                  <input className="form-input" value={transferNote}
                    onChange={e => setTransferNote(e.target.value)}
                    placeholder="Reason for transfer" disabled={!recipient} />
                </div>

                <button onClick={openTransferConfirm}
                  disabled={processing || !recipient || !parseFloat(transferAmt) ||
                    parseFloat(transferAmt) > displayBalance}
                  className="btn btn-gold" style={{ justifyContent:'center', gap:10 }}>
                  {`Send ₦${parseFloat(transferAmt||'0').toLocaleString()} to ${recipient?.name ?? '—'}`}
                </button>

                <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', textAlign:'center', margin:0 }}>
                  Transfers are instant and irreversible. A receipt appears automatically after each send.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {instantReceipt && (
        <InstantReceiptModal
          data={instantReceipt}
          onUpdate={setInstantReceipt}
          onClose={() => setInstantReceipt(null)}
        />
      )}
      {historyReceipt && (
        <HistoryReceiptModal
          data={historyReceipt}
          onClose={() => setHistoryReceipt(null)}
        />
      )}
      {showTransferConfirm && recipient && (
        <TransferConfirmModal
          recipient={recipient}
          amount={parseFloat(transferAmt || '0')}
          note={transferNote}
          senderName={member?.displayName ?? ''}
          senderIBI={member?.ibiNumber ?? ''}
          processing={processing}
          duplicateWarning={duplicateWarning}
          onConfirm={() => setPinPromptFor(false)}
          onConfirmDuplicate={() => setPinPromptFor(true)}
          onCancel={() => { setShowTransferConfirm(false); setDuplicateWarning(null); }}
        />
      )}
      {pinPromptFor !== null && (
        <PinConfirmModal
          title="Enter your PIN to send"
          subtitle={`Confirms sending ₦${parseFloat(transferAmt || '0').toLocaleString()} to ${recipient?.name ?? ''}.`}
          onConfirm={async (pin) => {
            await executeTransfer(pinPromptFor, pin);
            setPinPromptFor(null);
          }}
          onCancel={() => setPinPromptFor(null)}
        />
      )}
    </>
  );
}
