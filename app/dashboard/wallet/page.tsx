// app/dashboard/wallet/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Script from 'next/script';
import toast from 'react-hot-toast';

type TxType = 'credit' | 'debit';
interface Tx { id: string; type: TxType; amount: number; description: string; ref: string; createdAt: { seconds: number }; balance: number; }

const TOPUP_PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

export default function WalletPage() {
  const { member, refreshMember } = useAuth();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'topup' | 'transfer' | 'history'>('history');
  const [topupAmount, setTopup] = useState(5000);
  const [customTopup, setCustom]= useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferNote, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!member) return;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'transactions'), where('uid', '==', member.uid), orderBy('createdAt', 'desc'), limit(20))
        );
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Tx[]);
      } finally { setLoading(false); }
    })();
  }, [member]);

  const finalTopup = customTopup ? parseInt(customTopup) : topupAmount;

  const handleTopup = () => {
    if (finalTopup < 100) { toast.error('Minimum top-up is ₦100'); return; }
    setProcessing(true);
    const ref = `IBI-WLT-${Date.now()}`;
    const handler = (window as any).PaystackPop.setup({
      key:    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email:  member?.email,
      amount: finalTopup * 100,
      ref,
      currency: 'NGN',
      metadata: { uid: member?.uid, type: 'wallet_topup' },
      callback: async (res: { reference: string }) => {
        try {
          await fetch('/api/wallet/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference: res.reference, amount: finalTopup }),
          });
          toast.success(`₦${finalTopup.toLocaleString()} added to wallet!`);
          await refreshMember();
        } catch { toast.error('Top-up failed'); }
        finally { setProcessing(false); }
      },
      onClose: () => setProcessing(false),
    });
    handler.openIframe();
  };

  const handleTransfer = async () => {
    if (!transferTo.trim()) { toast.error('Enter recipient IBI number'); return; }
    const amt = parseFloat(transferAmt);
    if (!amt || amt < 100) { toast.error('Minimum transfer is ₦100'); return; }
    if (amt > (member?.walletBalance ?? 0)) { toast.error('Insufficient balance'); return; }
    setProcessing(true);
    try {
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientIbiNumber: transferTo, amount: amt, note: transferNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`₦${amt.toLocaleString()} transferred to ${transferTo}`);
      setTransferTo(''); setTransferAmt(''); setNote('');
      await refreshMember();
    } catch (e: any) {
      toast.error(e.message ?? 'Transfer failed');
    } finally { setProcessing(false); }
  };

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    background: active ? 'var(--bg-card)' : 'transparent',
    border: 'none',
    borderBottom: `2px solid ${active ? 'var(--ibi-gold)' : 'transparent'}`,
    color: active ? 'var(--ibi-gold)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 400,
    fontSize: '0.88rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', maxWidth: 640 }}>
        {/* Balance hero */}
        <div style={{
          background: 'linear-gradient(135deg, #0d1f0a 0%, #0a1a08 100%)',
          border: '1px solid rgba(74,222,128,0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-xl)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,222,128,0.06) 0%, transparent 70%)' }} />
          <div style={{ fontSize: '0.72rem', color: 'rgba(74,222,128,0.7)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>IBI Wallet Balance</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>
            ₦{(member?.walletBalance ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
            {member?.ibiNumber} · IBI Wallet
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
            {(['history', 'topup', 'transfer'] as const).map(t => (
              <button key={t} style={TAB_STYLE(tab === t)} onClick={() => setTab(t)}>
                {t === 'history' ? '📋 History' : t === 'topup' ? '➕ Top Up' : '↗️ Transfer'}
              </button>
            ))}
          </div>

          <div style={{ padding: 'var(--space-lg)' }}>
            {/* HISTORY */}
            {tab === 'history' && (
              <div>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
                    <div className="spinner" style={{ borderColor: 'var(--border-gold)', borderTopColor: 'var(--ibi-gold)', margin: '0 auto' }} />
                  </div>
                ) : transactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No transactions yet. Top up your wallet to get started.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {transactions.map((tx, i) => (
                      <div key={tx.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 4px',
                        borderBottom: i < transactions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: tx.type === 'credit' ? 'rgba(74,222,128,0.1)' : 'rgba(200,16,46,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.9rem', flexShrink: 0,
                          }}>
                            {tx.type === 'credit' ? '↓' : '↑'}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{tx.description}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {tx.ref} · {tx.createdAt ? new Date(tx.createdAt.seconds * 1000).toLocaleDateString() : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            color: tx.type === 'credit' ? '#4ade80' : 'var(--ibi-red-light)',
                          }}>
                            {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            Bal: ₦{tx.balance?.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TOP UP */}
            {tab === 'topup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <div>
                  <div className="form-label" style={{ marginBottom: 10 }}>Select Amount (₦)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                    {TOPUP_PRESETS.map(a => (
                      <button
                        key={a}
                        onClick={() => { setTopup(a); setCustom(''); }}
                        style={{
                          padding: '10px',
                          background: topupAmount === a && !customTopup ? 'var(--ibi-red)' : 'var(--bg-card)',
                          border: `1px solid ${topupAmount === a && !customTopup ? 'var(--ibi-red)' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-md)',
                          color: topupAmount === a && !customTopup ? '#fff' : 'var(--text-secondary)',
                          fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                          fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
                        }}
                      >
                        ₦{a.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Custom amount…"
                    value={customTopup}
                    onChange={e => { setCustom(e.target.value); setTopup(0); }}
                    min={100}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>You are adding</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#4ade80', fontSize: '1.1rem' }}>₦{finalTopup.toLocaleString()}</span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleTopup}
                  disabled={processing || finalTopup < 100}
                  style={{ justifyContent: 'center', gap: 10 }}
                >
                  {processing ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Processing…</> : `Top Up ₦${finalTopup.toLocaleString()} via Paystack`}
                </button>
              </div>
            )}

            {/* TRANSFER */}
            {tab === 'transfer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Recipient IBI Number</label>
                  <input
                    className="form-input"
                    value={transferTo}
                    onChange={e => setTransferTo(e.target.value.toUpperCase())}
                    placeholder="e.g. LAG/3847291056"
                    style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (₦)</label>
                  <input type="number" className="form-input" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} placeholder="Enter amount" min={100} />
                  {parseFloat(transferAmt) > (member?.walletBalance ?? 0) && (
                    <span className="form-error">Exceeds wallet balance</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Note (optional)</label>
                  <input className="form-input" value={transferNote} onChange={e => setNote(e.target.value)} placeholder="What is this for?" />
                </div>
                <button
                  className="btn btn-gold"
                  onClick={handleTransfer}
                  disabled={processing || !transferTo || !transferAmt}
                  style={{ justifyContent: 'center', gap: 10 }}
                >
                  {processing ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Sending…</> : `Send ₦${parseFloat(transferAmt || '0').toLocaleString()}`}
                </button>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Transfers are instant and free between IBI members.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
