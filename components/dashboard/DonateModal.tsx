// components/dashboard/DonateModal.tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import DualPayment from '@/components/DualPayment';
import { CAUSES, PRESET_AMOUNTS, MIN_DONATION_NAIRA } from '@/lib/donate-causes';
import { getAllChapters } from '@/lib/chapters-data';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

export default function DonateModal({ onClose }: Props) {
  const { member } = useAuth();
  const [cause,   setCause]   = useState('general');
  const [amount,  setAmount]  = useState(5000);
  const [custom,  setCustom]  = useState('');
  const [message, setMessage] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [success, setSuccess] = useState(false);

  // NAIRA throughout — DualPayment's amount prop is Naira, not kobo.
  const donationNaira = custom ? (parseInt(custom) || 0) : amount;
  const ref = `IBI-DON-${Date.now()}`;

  const handleSuccess = async (method: string, reference?: string, pin?: string) => {
    try {
      // /api/donate handles the wallet debit atomically server-side when
      // method === 'wallet' (see TECH_DEBT_AND_ROADMAP.md TD-01) — no
      // separate debit call needed here. pin is only present for the
      // wallet path — DualPayment collects it via PinConfirmModal right
      // before calling onSuccess, since a wallet donation is a
      // money-moving action just like a transfer or debit.
      const res = await fetch('/api/donate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cause, amount: donationNaira,
          name: member?.displayName ?? 'Member',
          email: member?.email, message, method, reference, clientRef: ref, pin, chapterName: chapterName || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not record donation');
      toast.success('Thank you for your donation! 🙏');
      setSuccess(true);
    } catch (e: any) {
      toast.error(e.message ?? 'Could not record donation');
      // Only the wallet path has anything downstream that awaits this and
      // can use a rethrow (DualPayment's PinConfirmModal, to show the
      // error inline and allow retry). The Paystack callback fires
      // onSuccess() completely fire-and-forget with no catcher — rethrowing
      // there becomes an unhandled promise rejection, not a helpful retry.
      if (method === 'wallet') throw e;
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.72)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div style={{
        background:'var(--bg-elevated)', border:'1px solid var(--border-gold)',
        borderRadius:'var(--radius-xl)', width:'100%', maxWidth:560,
        maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--grad-card)', flexShrink:0 }}>
          <div>
            <h3 style={{ margin:0, fontSize:'1rem' }}>Make a Donation</h3>
            <p style={{ margin:'3px 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>
              Support IBI without leaving your dashboard
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:22, cursor:'pointer', padding:'2px 6px' }}>×</button>
        </div>

        {success ? (
          <div style={{ padding:'var(--space-xl)', textAlign:'center' }}>
            <div style={{ fontSize:'3.5rem', marginBottom:16 }}>🙏</div>
            <h3 style={{ marginBottom:8 }}>Dalu! Thank You!</h3>
            <p style={{ color:'var(--text-secondary)', marginBottom:24 }}>
              Your donation of <strong style={{ color:'var(--ibi-gold)' }}>₦{donationNaira.toLocaleString()}</strong> to
              the <strong>{CAUSES.find(c => c.id === cause)?.label}</strong> fund has been received.
            </p>
            <button className="btn btn-gold" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div style={{ overflowY:'auto', padding:'var(--space-lg)', display:'flex', flexDirection:'column', gap:'var(--space-lg)' }}>

            {/* Cause — compact chip grid */}
            <div>
              <div className="form-label" style={{ marginBottom:8 }}>Select a Cause</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {CAUSES.map(c => (
                  <div key={c.id} onClick={() => setCause(c.id)} style={{
                    padding:'10px 12px', cursor:'pointer', transition:'all 0.15s',
                    background: cause === c.id ? 'rgba(212,175,55,0.08)' : 'var(--bg-card)',
                    border:`1px solid ${cause === c.id ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`,
                    borderRadius:'var(--radius-md)', display:'flex', alignItems:'center', gap:8,
                  }}>
                    <span style={{ fontSize:'1.1rem' }}>{c.icon}</span>
                    <div style={{ fontSize:'0.8rem', fontWeight:600, color: cause === c.id ? 'var(--ibi-gold)' : 'var(--text-primary)' }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <div className="form-label" style={{ marginBottom:8 }}>Donation Amount (₦)</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
                {PRESET_AMOUNTS.map(a => (
                  <button key={a} onClick={() => { setAmount(a); setCustom(''); }} style={{
                    padding:'10px', background: amount === a && !custom ? 'var(--ibi-red)' : 'var(--bg-card)',
                    border:`1px solid ${amount === a && !custom ? 'var(--ibi-red)' : 'var(--border-subtle)'}`,
                    borderRadius:'var(--radius-md)', color: amount === a && !custom ? '#fff' : 'var(--text-secondary)',
                    fontWeight:600, fontSize:'0.82rem', cursor:'pointer', fontFamily:'var(--font-mono)', transition:'all 0.15s',
                  }}>
                    ₦{a.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                type="number" className="form-input" placeholder="Or enter custom amount…"
                value={custom} onChange={e => { setCustom(e.target.value); setAmount(0); }}
                min={MIN_DONATION_NAIRA}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Credit a specific chapter? (optional)</label>
              <select className="form-select" value={chapterName} onChange={e => setChapterName(e.target.value)}>
                <option value="">No — credit the national purse</option>
                {getAllChapters().map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4 }}>
                Goes to that chapter's donation wallet instead of the national one.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Message (optional)</label>
              <textarea className="form-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="Leave a message for IBI…" rows={2} />
            </div>

            {/* Payment */}
            <div>
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>You are donating</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', fontWeight:900, color:'var(--ibi-gold)', marginBottom:2 }}>
                ₦{donationNaira.toLocaleString()}
              </div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:14 }}>
                to: <strong>{CAUSES.find(c => c.id === cause)?.label}</strong>
              </div>

              {donationNaira < MIN_DONATION_NAIRA ? (
                <p style={{ fontSize:'0.78rem', color:'var(--ibi-red-light)', textAlign:'center' }}>
                  Minimum donation is ₦{MIN_DONATION_NAIRA}
                </p>
              ) : (
                <DualPayment
                  amount={donationNaira}
                  email={member?.email}
                  label="Donate"
                  paystackRef={ref}
                  metadata={{ cause, donorName: member?.displayName, message }}
                  onSuccess={handleSuccess}
                  onError={err => toast.error(err)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
