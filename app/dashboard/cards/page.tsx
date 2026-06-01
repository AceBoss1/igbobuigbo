// app/dashboard/cards/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import DualPayment from '@/components/DualPayment';
import Script from 'next/script';
import toast from 'react-hot-toast';

const CARD_TYPES = [
  {
    id:    'verve',
    name:  'IBI Verve Debit Card',
    price: 2500,
    badge: 'VERVE',
    color: '#009f6b',
    bg:    'linear-gradient(135deg, #004d35 0%, #001a12 100%)',
    desc:  'Accepted across Nigeria at ATMs, POS terminals, and online.',
    perks: ['Free ATM withdrawals (3/month)', 'POS payments nationwide', 'Online shopping in Nigeria', 'IBI branding'],
  },
  {
    id:    'visa',
    name:  'IBI Visa Debit Card',
    price: 5000,
    badge: 'VISA',
    color: '#1a1f71',
    bg:    'linear-gradient(135deg, #0a0e3d 0%, #1a1f71 100%)',
    desc:  'Accepted globally wherever Visa is accepted, including international transfers.',
    perks: ['Worldwide acceptance', 'International online payments', '3 free ATM withdrawals/month', 'IBI premium branding', 'Travel insurance included'],
  },
];

interface CardOrder {
  id: string;
  cardType: string;
  status: string;
  createdAt: { seconds: number };
  deliveryAddress: string;
}

export default function CardsPage() {
  const { member } = useAuth();
  const [orders, setOrders]         = useState<CardOrder[]>([]);
  const [loadingOrders, setLoading] = useState(true);
  const [selected, setSelected]     = useState<typeof CARD_TYPES[0] | null>(null);
  const [step, setStep]             = useState<'select' | 'address' | 'pay'>('select');
  const [address, setAddress]       = useState({ street: '', city: '', state: '', phone: '' });
  const [success, setSuccess]       = useState(false);

  useEffect(() => {
    if (!member) return;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'cardOrders'), where('uid', '==', member.uid), orderBy('createdAt', 'desc')));
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CardOrder[]);
      } finally { setLoading(false); }
    })();
  }, [member]);

  const handlePaySuccess = async (method: string, reference?: string) => {
    try {
      const res = await fetch('/api/cards/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType: selected?.id, address, method, reference }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Card order placed! Delivery in 5–10 business days.');
      setSuccess(true);
      setStep('select');
      setSelected(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: 'var(--ibi-gold)',
    processing: '#60a5fa',
    shipped: '#a78bfa',
    delivered: '#4ade80',
    cancelled: 'var(--ibi-red-light)',
  };

  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', maxWidth: 720 }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ibi-gold)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>IBI Cards</div>
          <h2 style={{ marginBottom: 4 }}>Order Your IBI Debit Card</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Carry your IBI membership in your wallet. Available in Verve (Nigeria) and Visa (Global).</p>
        </div>

        {success && (
          <div style={{ padding: 'var(--space-lg)', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 'var(--radius-lg)' }}>
            🎉 Order placed successfully! Check your delivery status below.
          </div>
        )}

        {/* Card selection */}
        {step === 'select' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
            {CARD_TYPES.map(card => (
              <div key={card.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {/* Card visual */}
                <div style={{
                  aspectRatio: '1.586 / 1',
                  background: card.bg,
                  borderRadius: 16,
                  border: `1.5px solid ${selected?.id === card.id ? card.color : 'rgba(255,255,255,0.1)'}`,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: selected?.id === card.id ? `0 0 0 3px ${card.color}40` : 'var(--shadow-lg)',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => { setSelected(card); setStep('address'); }}>
                  <div style={{ position: 'absolute', bottom: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${card.color}20, transparent 70%)` }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--grad-red)', border: '1.5px solid rgba(212,175,55,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#fff' }}>IBI</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Igbobuigbo</div>
                    </div>
                    <div style={{ padding: '3px 10px', background: `${card.color}30`, border: `1px solid ${card.color}60`, borderRadius: 99, fontSize: 9, fontWeight: 900, color: card.color, letterSpacing: '0.1em' }}>
                      {card.badge}
                    </div>
                  </div>

                  {/* Chip */}
                  <div style={{ width: 36, height: 28, background: 'linear-gradient(135deg, #d4af37, #a07c10)', borderRadius: 5, position: 'relative' }} />

                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: 14, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.15em', marginBottom: 8 }}>
                      •••• •••• •••• ••••
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Card Holder</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>
                          {member?.displayName?.slice(0, 22)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>IBI No.</div>
                        <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>{member?.ibiNumber}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="card" style={{ flex: 1 }}>
                  <h4 style={{ marginBottom: 8, fontSize: '0.95rem' }}>{card.name}</h4>
                  <p style={{ fontSize: '0.82rem', marginBottom: 12 }}>{card.desc}</p>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {card.perks.map(p => (
                      <li key={p} style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}>
                          <polyline points="20,6 9,17 4,12"/>
                        </svg>
                        {p}
                      </li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--ibi-gold)' }}>
                      ₦{card.price.toLocaleString()}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => { setSelected(card); setStep('address'); }}
                    >
                      Order Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delivery address */}
        {step === 'address' && selected && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)' }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>Delivery Address — {selected.name}</h3>
            <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Street Address *</label>
                <input className="form-input" value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} placeholder="15 Ozumba Mbadiwe Street" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">City / LGA *</label>
                  <input className="form-input" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} placeholder="Awka" />
                </div>
                <div className="form-group">
                  <label className="form-label">State *</label>
                  <input className="form-input" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} placeholder="Anambra" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input className="form-input" type="tel" value={address.phone} onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))} placeholder="08012345678" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 'var(--space-lg)' }}>
              <button className="btn btn-ghost" onClick={() => setStep('select')}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!address.street || !address.city || !address.state || !address.phone) { toast.error('Fill in all address fields'); return; }
                  setStep('pay');
                }}
              >
                Proceed to Payment →
              </button>
            </div>
          </div>
        )}

        {/* Payment */}
        {step === 'pay' && selected && (
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)' }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>Complete Your Order</h3>
            <div style={{ marginBottom: 'var(--space-lg)', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Ordering</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selected.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>Delivery to: {address.street}, {address.city}, {address.state}</div>
            </div>
            <DualPayment
              amount={selected.price * 100}
              label="Pay for Card"
              paystackRef={`IBI-CARD-${Date.now()}`}
              metadata={{ cardType: selected.id, address }}
              onSuccess={handlePaySuccess}
              onError={err => toast.error(err)}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setStep('address')} style={{ marginTop: 12 }}>← Back</button>
          </div>
        )}

        {/* Existing orders */}
        {orders.length > 0 && (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
              Your Card Orders
            </div>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {orders.map((o, i) => (
                <div key={o.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: i < orders.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>IBI {o.cardType?.toUpperCase()} Card</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString() : ''} · {o.deliveryAddress}
                    </div>
                  </div>
                  <span className="badge" style={{
                    background: `${STATUS_COLOR[o.status] ?? 'var(--text-muted)'}20`,
                    color: STATUS_COLOR[o.status] ?? 'var(--text-muted)',
                    border: `1px solid ${STATUS_COLOR[o.status] ?? 'var(--border-subtle)'}60`,
                    textTransform: 'capitalize',
                  }}>
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
