// app/donate/page.tsx
'use client';
import { useState } from 'react';
import DualPayment from '@/components/DualPayment';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/AuthContext';
import { CAUSES, PRESET_AMOUNTS, MIN_DONATION_NAIRA } from '@/lib/donate-causes';
import { getAllChapters } from '@/lib/chapters-data';

export default function DonatePage() {
  const { member } = useAuth();
  const [cause,    setCause]   = useState('general');
  const [amount,   setAmount]  = useState(5000);
  const [custom,   setCustom]  = useState('');
  const [name,     setName]    = useState(member?.displayName ?? '');
  const [email,    setEmail]   = useState(member?.email ?? '');
  const [message,  setMessage] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [anon,     setAnon]    = useState(false);
  const [success,  setSuccess] = useState(false);

  // NAIRA throughout — DualPayment's amount prop is Naira, not kobo
  // (it converts to kobo internally for Paystack). Previously this
  // multiplied by 100 here on top of that internal conversion, which
  // billed donors 100x what they selected.
  const donationNaira = custom ? (parseInt(custom) || 0) : amount;
  const ref = `IBI-DON-${Date.now()}`;

  const handleSuccess = async (method: string, reference?: string, pin?: string) => {
    try {
      // /api/donate handles the wallet debit atomically server-side when
      // method === 'wallet' (see TECH_DEBT_AND_ROADMAP.md TD-01) — no
      // separate debit call needed here. pin is only populated on the
      // wallet path (DualPayment collects it via its own PinConfirmModal
      // before calling onSuccess).
      const res = await fetch('/api/donate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cause, amount: donationNaira,
          name: anon ? 'Anonymous' : name,
          email, message, method, reference, clientRef: ref, pin, chapterName: chapterName || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not record donation');
      toast.success('Thank you for your donation! 🙏');
      setSuccess(true);
    } catch (e: any) {
      toast.error(e.message ?? 'Could not record donation');
      // Only the wallet path has a catcher downstream (DualPayment's
      // PinConfirmModal). The Paystack callback is fire-and-forget —
      // rethrowing there is an unhandled promise rejection, not a retry.
      if (method === 'wallet') throw e;
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 var(--space-lg)' }}>
          <div style={{ fontSize: '5rem', marginBottom: 24 }}>🙏</div>
          <h2 style={{ marginBottom: 12 }}>Dalu! Thank You!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            Your donation of{' '}
            <strong style={{ color: 'var(--ibi-gold)' }}>₦{donationNaira.toLocaleString()}</strong>{' '}
            to the <strong>{CAUSES.find(c => c.id === cause)?.label}</strong> fund has been received.
          </p>
          <a href="/" className="btn btn-primary btn-lg">Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: 96, paddingBottom: 'var(--space-3xl)' }}>
      <div className="container" style={{ maxWidth: 1000 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <div className="section-label">Support IBI</div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: 12 }}>Make a Donation</h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto' }}>
            Your contribution fuels IBI's mission — from scholarships to market empowerment. Every naira counts.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-xl)' }}>

          {/* Left: Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

            {/* Cause */}
            <div>
              <div className="form-label" style={{ marginBottom: 'var(--space-sm)' }}>Select a Cause</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {CAUSES.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setCause(c.id)}
                    style={{
                      padding: '12px 16px',
                      background: cause === c.id ? 'rgba(212,175,55,0.08)' : 'var(--bg-elevated)',
                      border: `1px solid ${cause === c.id ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: '1.3rem' }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: cause === c.id ? 'var(--ibi-gold)' : 'var(--text-primary)' }}>{c.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <div className="form-label" style={{ marginBottom: 'var(--space-sm)' }}>Donation Amount (₦)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                {PRESET_AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => { setAmount(a); setCustom(''); }}
                    style={{
                      padding: '10px',
                      background: amount === a && !custom ? 'var(--ibi-red)' : 'var(--bg-elevated)',
                      border: `1px solid ${amount === a && !custom ? 'var(--ibi-red)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-md)',
                      color: amount === a && !custom ? '#fff' : 'var(--text-secondary)',
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
                placeholder="Or enter custom amount…"
                value={custom}
                onChange={e => { setCustom(e.target.value); setAmount(0); }}
                min={100}
              />
            </div>

            {/* Donor info */}
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem' }}>
                <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} />
                <span style={{ color: 'var(--text-secondary)' }}>Donate anonymously</span>
              </label>
              {!anon && (
                <>
                  <div className="form-group">
                    <label className="form-label">Your Name</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email (for receipt)</label>
                    <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                </>
              )}
              <div className="form-group">
                <label className="form-label">Credit a specific chapter? (optional)</label>
                <select className="form-select" value={chapterName} onChange={e => setChapterName(e.target.value)}>
                  <option value="">No — credit the national purse</option>
                  {getAllChapters().map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Message (optional)</label>
                <textarea className="form-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="Leave a message for IBI…" rows={3} />
              </div>
            </div>
          </div>

          {/* Right: Payment */}
          <div>
            <div style={{
              position: 'sticky', top: 96,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-xl)',
              display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)',
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>You are donating</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 900, color: 'var(--ibi-gold)' }}>
                  ₦{donationNaira.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  to: <strong>{CAUSES.find(c => c.id === cause)?.label}</strong>
                </div>
              </div>

              <DualPayment
                amount={donationNaira}
                email={email || member?.email}
                label="Donate"
                paystackRef={ref}
                metadata={{ cause, donorName: anon ? 'Anonymous' : name, message }}
                onSuccess={handleSuccess}
                onError={err => toast.error(err)}
                disabled={donationNaira < MIN_DONATION_NAIRA}
              />

              {donationNaira < MIN_DONATION_NAIRA && (
                <p style={{ fontSize: '0.78rem', color: 'var(--ibi-red-light)', textAlign: 'center' }}>
                  Minimum donation is ₦{MIN_DONATION_NAIRA}
                </p>
              )}

              <div style={{ padding: '12px', background: 'rgba(212,175,55,0.04)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-gold)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                💛 100% of your donation goes directly to the selected cause. IBI is a registered non-profit organisation.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
