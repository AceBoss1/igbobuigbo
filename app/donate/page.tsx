// app/donate/page.tsx
'use client';
import { useState } from 'react';
import Script from 'next/script';
import DualPayment from '@/components/DualPayment';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/AuthContext';

const CAUSES = [
  { id: 'general',   label: 'General Fund',        desc: 'Support IBI operations and programs', icon: '🏛️' },
  { id: 'scholarship', label: 'IBI Scholarship',   desc: 'Fund education for Igbo youth',       icon: '🎓' },
  { id: 'empowerment', label: 'Women Empowerment', desc: 'Support Igbo women in business',       icon: '👩‍💼' },
  { id: 'tech',      label: 'IBI Tech Hub',         desc: 'Build our digital infrastructure',    icon: '💻' },
  { id: 'disaster',  label: 'Disaster Relief',      desc: 'Aid Igbo communities in crisis',      icon: '🆘' },
];

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

export default function DonatePage() {
  const { member } = useAuth();
  const [cause,    setCause]    = useState('general');
  const [amount,   setAmount]   = useState(5000);
  const [custom,   setCustom]   = useState('');
  const [name,     setName]     = useState(member?.displayName ?? '');
  const [email,    setEmail]    = useState(member?.email ?? '');
  const [message,  setMessage]  = useState('');
  const [anonymous, setAnon]    = useState(false);
  const [success,  setSuccess]  = useState(false);

  const finalAmount = custom ? parseInt(custom) * 100 : amount * 100;
  const ref = `IBI-DON-${Date.now()}`;

  const handleSuccess = async (method: string, reference?: string) => {
    try {
      await fetch('/api/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cause, amount: finalAmount / 100, name: anonymous ? 'Anonymous' : name, email, message, method, reference }),
      });
      toast.success('Thank you for your donation! 🙏');
      setSuccess(true);
    } catch {
      toast.error('Could not record donation');
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: '5rem', marginBottom: 24 }}>🙏</div>
          <h2 style={{ marginBottom: 12 }}>Dalu! Thank You!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
            Your generous donation of <strong style={{ color: 'var(--ibi-gold)' }}>₦{(finalAmount/100).toLocaleString()}</strong> to the <strong>{CAUSES.find(c=>c.id===cause)?.label}</strong> fund has been received. IBI appreciates your solidarity.
          </p>
          <a href="/" className="btn btn-primary btn-lg">Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
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
              {/* Cause selector */}
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '1.3rem' }}>{c.icon}</span>
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: cause === c.id ? 'var(--ibi-gold)' : 'var(--text-primary)' }}>
                          {c.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <div className="form-label" style={{ marginBottom: 'var(--space-sm)' }}>Donation Amount (₦)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
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
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'var(--font-mono)',
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
                  <input type="checkbox" checked={anonymous} onChange={e => setAnon(e.target.checked)} />
                  <span style={{ color: 'var(--text-secondary)' }}>Donate anonymously</span>
                </label>
                {!anonymous && (
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
                  <label className="form-label">Message (optional)</label>
                  <textarea className="form-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="Leave a message for IBI…" rows={3} />
                </div>
              </div>
            </div>

            {/* Right: Payment */}
            <div>
              <div style={{
                position: 'sticky',
                top: 96,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-xl)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-lg)',
              }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>You are donating</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 900, color: 'var(--ibi-gold)' }}>
                    ₦{(finalAmount/100).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    to: <strong>{CAUSES.find(c=>c.id===cause)?.label}</strong>
                  </div>
                </div>

                <DualPayment
                  amount={finalAmount}
                  email={email || member?.email}
                  label="Donate"
                  paystackRef={ref}
                  metadata={{ cause, donorName: anonymous ? 'Anonymous' : name, message }}
                  onSuccess={handleSuccess}
                  onError={err => toast.error(err)}
                  disabled={finalAmount < 10000}
                />

                {finalAmount < 10000 && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--ibi-red-light)', textAlign: 'center' }}>
                    Minimum donation is ₦100
                  </p>
                )}

                {/* Impact statement */}
                <div style={{ padding: '12px', background: 'rgba(212,175,55,0.04)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-gold)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  💛 100% of your donation goes directly to the selected cause. IBI is a registered non-profit organisation.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
