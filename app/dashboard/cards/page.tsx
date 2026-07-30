// app/dashboard/cards/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db }          from '@/lib/firebase';
import { useAuth }     from '@/lib/AuthContext';
import DualPayment     from '@/components/DualPayment';
import toast           from 'react-hot-toast';

// ─── Card definitions ─────────────────────────────────────────────────────────
//
// NAIRA CARDS (verve, afrigo):
//   virtual  = ₦1,000   (was incorrectly set to 100,000 — now corrected)
//   physical = ₦4,000   (was incorrectly set to 400,000 — now corrected)
//   These match exactly what /api/cards/order debits from the wallet.
//
// USD CARDS (visa, mastercard):
//   usdOnly = true → ordering is DISABLED until the admin exchange-rate
//   feature is live and USD is introduced as a second wallet currency.

const CARDS = [
  {
    id: 'verve', name: 'IBI Verve Card', network: 'Verve Debit',
    currency: 'Naira (₦)', scope: 'Nigeria & Online',
    images: ['/ibi-verve-card.webp', '/ibi-verve-card.png'],
    badge: 'IBI VERVE CARD', badgeColor: '#00b16a',
    virtual: 1000,   // ₦1,000 — fixed (was 100,000)
    physical: 4000,  // ₦4,000 — fixed (was 400,000)
    usdOnly: false,
    perks: [
      'Accepted at all Nigerian ATMs & POS',
      'Online payments on Verve-enabled platforms',
      'Freeze/unfreeze instantly from dashboard',
      'WhatsApp & push alert on every transaction',
    ],
    tags: ['ATM Withdrawals', 'POS Payments', 'Local Online'],
    tagColors: ['#00b16a', '#00b16a', '#00b16a'],
  },
  {
    id: 'afrigo', name: 'IBI AfriGo Card', network: 'AfriGo Debit',
    currency: 'Naira (₦)', scope: 'Nigeria & Pan-Africa',
    images: ['/ibi-afrigo-card.webp', '/ibi-afrigo-card.png'],
    badge: 'IBI AFRIGO CARD', badgeColor: '#e67e22',
    virtual: 1000,   // ₦1,000 — fixed
    physical: 4000,  // ₦4,000 — fixed
    usdOnly: false,
    perks: [
      'Pan-African acceptance across Nigeria, Ghana, Kenya+',
      'CBN-approved domestic card',
      'Lower transaction fees',
      'Instant virtual activation',
    ],
    tags: ['ATM Withdrawals', 'Pan-Africa', 'POS Payments'],
    tagColors: ['#e67e22', '#e67e22', '#e67e22'],
  },
  {
    id: 'visa', name: 'IBI Visa Card', network: 'Visa Debit',
    currency: 'USD ($)', scope: 'Worldwide',
    images: ['/ibi-visa-card.webp', '/ibi-visa-card.png'],
    badge: 'IBI VISA CARD', badgeColor: '#4a7fff',
    virtual: 200, physical: null,
    usdOnly: true, // ordering disabled — awaiting admin USD exchange rate
    perks: [
      'Worldwide ATM withdrawals & POS',
      'International online shopping',
      'Configurable daily spending limits',
      'Full transaction history in dashboard',
    ],
    tags: ['ATM Withdrawals', 'International', 'Online & POS'],
    tagColors: ['#4a7fff', '#4a7fff', '#4a7fff'],
  },
  {
    id: 'mastercard', name: 'IBI Mastercard', network: 'Mastercard Debit',
    currency: 'USD ($)', scope: 'Worldwide',
    images: ['/ibi-mastercard-card.webp', '/ibi-mastercard-card.png'],
    badge: 'IBI MASTERCARD', badgeColor: '#eb001b',
    virtual: 200, physical: null,
    usdOnly: true, // ordering disabled — awaiting admin USD exchange rate
    perks: [
      'Accepted in 210+ countries',
      'Mastercard Zero Liability protection',
      'Access to Mastercard exclusive benefits',
      'Real-time spend notifications',
    ],
    tags: ['210+ Countries', 'Zero Liability', 'Online & POS'],
    tagColors: ['#eb001b', '#f79e1b', '#eb001b'],
  },
];

interface CardOrder {
  id: string; cardType: string; cardTier: string; status: string;
  createdAt: { seconds: number }; deliveryAddress: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending:    'var(--ibi-gold)',
  processing: '#60a5fa',
  shipped:    '#a78bfa',
  delivered:  '#4ade80',
  cancelled:  'var(--ibi-red-light)',
};

export default function CardsPage() {
  const { member } = useAuth();
  const [orders,   setOrders]   = useState<CardOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<typeof CARDS[0] | null>(null);
  const [tier,     setTier]     = useState<'virtual' | 'physical'>('virtual');
  const [step,     setStep]     = useState<'select' | 'address' | 'pay'>('select');
  const [address,  setAddress]  = useState({ street:'', city:'', state:'', phone:'' });
  const [success,  setSuccess]  = useState(false);

  useEffect(() => {
    if (!member || !db) { setLoading(false); return; }
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'cardOrders'), where('uid', '==', member.uid), orderBy('createdAt', 'desc'))
        );
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CardOrder[]);
      } finally { setLoading(false); }
    })();
  }, [member]);

  // price is always in Naira — matches what /api/cards/order debits
  const price = selected
    ? (tier === 'virtual' ? selected.virtual : (selected.physical ?? 0))
    : 0;

  const handlePaySuccess = async (method: string, reference?: string, pin?: string) => {
    try {
      const res = await fetch('/api/cards/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType: selected?.id, cardTier: tier, address, method, reference, pin }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Card order placed! Processing will begin shortly.');
      setSuccess(true); setStep('select'); setSelected(null);
    } catch (e: any) {
      toast.error(e.message);
      throw e; // must rethrow — DualPayment awaits this call to know whether to close its PIN modal
    }
  };

  // ── Card image with webp → png fallback ───────────────────────────────────
  const CardImage = ({ card, compact = false }: { card: typeof CARDS[0]; compact?: boolean }) => {
    const [imgIdx,    setImgIdx]    = useState(0);
    const [imgFailed, setImgFailed] = useState(false);

    return (
      <div style={{
        width: '100%', aspectRatio: '1.586/1', borderRadius: compact ? 10 : 14,
        overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg,#1a0008,#2d0010)',
        border: `1px solid ${card.badgeColor}30`,
        boxShadow: selected?.id === card.id ? `0 0 0 3px ${card.badgeColor}60, var(--shadow-lg)` : 'var(--shadow-md)',
        transition: 'box-shadow 0.3s',
      }}>
        {!imgFailed && imgIdx < card.images.length ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.images[imgIdx]} alt={card.name}
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            onError={() => {
              if (imgIdx + 1 < card.images.length) setImgIdx(i => i + 1);
              else setImgFailed(true);
            }} />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(135deg,#1a0008 0%,#2d000f 60%,${card.badgeColor}18 100%)`,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5%',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'clamp(7px,1.8vw,11px)', fontWeight:900, color:'#fff', letterSpacing:'0.05em' }}>IGBO BU IGBO</div>
              <div style={{ fontSize:'clamp(6px,1.4vw,9px)', fontWeight:900, color:card.badgeColor, padding:'2px 8px', background:`${card.badgeColor}20`, borderRadius:99 }}>OFFICIAL MEMBER</div>
            </div>
            <div>
              <div style={{ fontFamily:'monospace', fontSize:'clamp(10px,2.8vw,16px)', color:'rgba(255,255,255,0.85)', letterSpacing:'0.12em', marginBottom:'4%' }}>XXXX  XXXX  XXXX  XXXX</div>
              <div style={{ fontSize:'clamp(8px,2vw,12px)', fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                {member?.displayName?.slice(0, 22) ?? 'IBI MEMBER'}
              </div>
            </div>
          </div>
        )}

        {/* Card name label */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          padding:'clamp(6px,1.5vw,10px) clamp(8px,2vw,14px)',
          background:'linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%)',
          display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        }}>
          <div style={{ background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', padding:'3px 10px', borderRadius:'var(--radius-full)', border:`1px solid ${card.badgeColor}50` }}>
            <div style={{ fontSize:'clamp(6px,1.4vw,9px)', fontWeight:700, color:card.badgeColor, letterSpacing:'0.1em', textTransform:'uppercase' }}>
              {card.badge}
            </div>
          </div>
          <div style={{ fontSize:'clamp(6px,1.2vw,8px)', color:'rgba(255,255,255,0.55)', fontStyle:'italic' }}>
            {card.currency}
          </div>
        </div>

        {/* USD coming-soon overlay */}
        {card.usdOnly && (
          <div style={{
            position:'absolute', inset:0,
            background:'rgba(0,0,0,0.55)',
            backdropFilter:'blur(2px)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <div style={{
              background:'rgba(0,0,0,0.75)', border:'1px solid rgba(255,255,255,0.15)',
              borderRadius:8, padding:'8px 16px',
              fontSize:'0.78rem', fontWeight:700, color:'rgba(255,255,255,0.7)',
              textAlign:'center', letterSpacing:'0.05em',
            }}>
              🔜 Coming Soon<br />
              <span style={{ fontSize:'0.65rem', fontWeight:400, opacity:0.7 }}>USD exchange rate pending</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xl)', maxWidth:820 }}>

      <div>
        <div className="section-label">IBI Membership Cards</div>
        <h2 style={{ marginBottom:6 }}>My IBI Membership Cards</h2>
        <p style={{ color:'var(--text-muted)', fontSize:'0.88rem', maxWidth:640 }}>
          Order a virtual or physical Igbo Bu Igbo membership card — Verve or AfriGo (Naira, virtual + physical) · Visa or Mastercard (USD virtual, coming soon).
        </p>
      </div>

      <div style={{ padding:'12px 16px', background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'var(--radius-md)', fontSize:'0.83rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
        ℹ️ Your IBI membership card is a <strong style={{ color:'var(--text-primary)' }}>dual-purpose identity + debit card</strong> displaying your name, photo, membership ID, position, and chapter. Physical cards delivered within 7–14 business days.
      </div>

      {/* USD coming soon notice */}
      <div style={{ padding:'10px 14px', background:'rgba(212,175,55,0.06)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'var(--radius-md)', fontSize:'0.8rem', color:'var(--ibi-gold)', lineHeight:1.6 }}>
        🔜 <strong>Visa &amp; Mastercard (USD)</strong> ordering will be enabled once the admin USD exchange rate is configured.
      </div>

      {success && (
        <div style={{ padding:'var(--space-lg)', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'var(--radius-lg)', color:'#4ade80' }}>
          🎉 Card order placed! Track delivery below.
        </div>
      )}

      {/* ── SELECT ─────────────────────────────────────────────────────────── */}
      {step === 'select' && (
        <div>
          <p style={{ fontSize:'0.83rem', color:'var(--text-muted)', marginBottom:'var(--space-lg)' }}>
            Click a card to select it. Verve &amp; AfriGo are available now. Visa &amp; Mastercard (USD) coming soon.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))', gap:'var(--space-xl)' }}>
            {CARDS.map(card => (
              <div key={card.id}
                onClick={() => !card.usdOnly && setSelected(card)}
                style={{
                  background:    selected?.id === card.id ? 'rgba(212,175,55,0.04)' : 'var(--bg-elevated)',
                  border:        `1px solid ${selected?.id === card.id ? card.badgeColor : 'var(--border-subtle)'}`,
                  borderRadius:  'var(--radius-xl)', overflow:'hidden',
                  cursor:        card.usdOnly ? 'default' : 'pointer',
                  opacity:       card.usdOnly ? 0.7 : 1,
                  transition:    'all 0.25s',
                  boxShadow:     selected?.id === card.id ? `0 0 0 2px ${card.badgeColor}40` : 'none',
                }}>
                <div style={{ padding:'16px 16px 12px' }}>
                  <CardImage card={card} />
                </div>
                <div style={{ padding:'0 16px 16px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--text-primary)' }}>{card.name}</div>
                      <div style={{ fontSize:'0.75rem', color:card.badgeColor, fontWeight:600, marginTop:2 }}>{card.currency} · {card.scope}</div>
                    </div>
                    <div style={{
                      width:20, height:20, borderRadius:'50%',
                      border:`2px solid ${selected?.id === card.id ? card.badgeColor : 'var(--border-subtle)'}`,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    }}>
                      {selected?.id === card.id && <div style={{ width:10, height:10, borderRadius:'50%', background:card.badgeColor }} />}
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                    {card.tags.map((t, i) => (
                      <span key={t} style={{ padding:'3px 10px', background:`${card.tagColors[i]}15`, border:`1px solid ${card.tagColors[i]}40`, borderRadius:99, fontSize:'0.68rem', fontWeight:600, color:card.tagColors[i] }}>✓ {t}</span>
                    ))}
                  </div>

                  {/* Pricing display */}
                  <div style={{ display:'grid', gridTemplateColumns:`repeat(${card.physical ? 2 : 1},1fr)`, gap:8, marginBottom:12 }}>
                    <div style={{ padding:'10px', background:'var(--bg-card)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)', textAlign:'center' }}>
                      <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Virtual Card</div>
                      {card.usdOnly ? (
                        /* USD: show coming-soon instead of price */
                        <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', fontStyle:'italic' }}>Price TBD</div>
                      ) : (
                        <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ibi-gold)', fontSize:'1.1rem' }}>
                          ₦{card.virtual.toLocaleString()}
                        </div>
                      )}
                      <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:2 }}>
                        {card.usdOnly ? 'USD rate pending' : 'Instant activation'}
                      </div>
                    </div>
                    {card.physical && (
                      <div style={{ padding:'10px', background:'var(--bg-card)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)', textAlign:'center' }}>
                        <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>Physical Card</div>
                        <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ibi-gold)', fontSize:'1.1rem' }}>
                          ₦{card.physical.toLocaleString()}
                        </div>
                        <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:2 }}>Delivered 7–14 days</div>
                      </div>
                    )}
                  </div>

                  <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:6 }}>
                    {card.perks.map(p => (
                      <li key={p} style={{ display:'flex', gap:8, fontSize:'0.78rem', color:'var(--text-secondary)', alignItems:'flex-start' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={card.badgeColor} strokeWidth="2.5" style={{ flexShrink:0, marginTop:2 }}>
                          <polyline points="20,6 9,17 4,12"/>
                        </svg>
                        {p}
                      </li>
                    ))}
                  </ul>

                  {/* USD cards: show locked state */}
                  {card.usdOnly && (
                    <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(212,175,55,0.06)', border:'1px solid rgba(212,175,55,0.2)', borderRadius:'var(--radius-md)', fontSize:'0.75rem', color:'var(--text-muted)', textAlign:'center' }}>
                      🔜 Ordering available after admin configures USD exchange rate
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selected && !selected.usdOnly && (
            <div style={{ marginTop:'var(--space-xl)', display:'flex', justifyContent:'flex-end' }}>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(selected.physical ? 'address' : 'pay')}>
                Order {selected.name} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ADDRESS ─────────────────────────────────────────────────────────── */}
      {step === 'address' && selected && (
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-xl)', padding:'var(--space-xl)' }}>
          <div style={{ maxWidth:320, marginBottom:'var(--space-lg)' }}>
            <CardImage card={selected} />
          </div>

          {selected.physical && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:'var(--space-lg)' }}>
              {(['virtual', 'physical'] as const).map(t => (
                <div key={t} onClick={() => setTier(t)} style={{
                  padding:'14px', cursor:'pointer', textAlign:'center', transition:'all 0.2s',
                  background: tier === t ? 'rgba(212,175,55,0.08)' : 'var(--bg-card)',
                  border:`1px solid ${tier === t ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`,
                  borderRadius:'var(--radius-lg)',
                }}>
                  <div style={{ fontWeight:700, color: tier === t ? 'var(--ibi-gold)' : 'var(--text-primary)', marginBottom:4, textTransform:'capitalize' }}>{t} Card</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.1rem', color:'var(--ibi-gold)', fontWeight:700 }}>
                    ₦{(t === 'virtual' ? selected.virtual : selected.physical!).toLocaleString()}
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>
                    {t === 'virtual' ? 'Instant activation' : 'Delivered 7–14 days'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tier === 'physical' && (
            <>
              <h3 style={{ marginBottom:'var(--space-lg)' }}>Delivery Address</h3>
              <div style={{ display:'grid', gap:'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Street Address *</label>
                  <input className="form-input" value={address.street} onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} placeholder="15 Ozumba Mbadiwe Street" />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">City / LGA *</label>
                    <input className="form-input" value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} placeholder="Enugu" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <input className="form-input" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} placeholder="Enugu State" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input className="form-input" type="tel" value={address.phone} onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))} placeholder="08067871203" />
                </div>
              </div>
            </>
          )}

          <div style={{ display:'flex', gap:12, marginTop:'var(--space-lg)' }}>
            <button className="btn btn-ghost" onClick={() => setStep('select')}>← Back</button>
            <button className="btn btn-primary" onClick={() => {
              if (tier === 'physical' && (!address.street || !address.city || !address.state || !address.phone)) {
                toast.error('Fill in all delivery fields'); return;
              }
              setStep('pay');
            }}>Proceed to Payment →</button>
          </div>
        </div>
      )}

      {/* ── PAY ─────────────────────────────────────────────────────────────── */}
      {step === 'pay' && selected && (
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-xl)', padding:'var(--space-xl)' }}>
          <h3 style={{ marginBottom:'var(--space-lg)' }}>Complete Your Order</h3>
          <div style={{ marginBottom:'var(--space-lg)', padding:'12px 16px', background:'var(--bg-card)', borderRadius:'var(--radius-md)', border:'1px solid var(--border-subtle)' }}>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>Ordering</div>
            <div style={{ fontWeight:600, color:'var(--text-primary)' }}>
              {selected.name} — {tier === 'virtual' ? 'Virtual' : 'Physical'}
            </div>
            {tier === 'physical' && (
              <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:4 }}>
                Delivery to: {address.street}, {address.city}, {address.state}
              </div>
            )}
            {/* Price — always Naira for available cards */}
            <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ibi-gold)', marginTop:6, fontSize:'1.1rem' }}>
              ₦{price.toLocaleString()}
            </div>
          </div>

          <DualPayment
            amount={price}                      // DualPayment takes NAIRA — it converts to kobo internally for Paystack
            label={`IBI ${selected.id.toUpperCase()} Card — ${tier}`}
            paystackRef={`IBI-CARD-${Date.now()}`}
            metadata={{ uid: member?.uid, cardType: selected.id, cardTier: tier, address }}
            onSuccess={handlePaySuccess}
            onError={(err: string) => toast.error(err)}
          />
          <button className="btn btn-ghost btn-sm"
            onClick={() => setStep(selected.physical ? 'address' : 'select')}
            style={{ marginTop:12 }}>← Back</button>
        </div>
      )}

      {/* ── Orders ─────────────────────────────────────────────────────────── */}
      {orders.length > 0 && (
        <div>
          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'var(--space-md)' }}>
            Your Card Orders
          </div>
          <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
            {orders.map((o, i) => (
              <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom: i < orders.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div>
                  <div style={{ fontSize:'0.88rem', color:'var(--text-primary)', fontWeight:500 }}>
                    IBI {o.cardType?.toUpperCase()} — {o.cardTier}
                  </div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                    {o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString() : ''}
                    {o.deliveryAddress ? ` · ${o.deliveryAddress}` : ''}
                  </div>
                </div>
                <span className="badge" style={{
                  background: `${STATUS_COLOR[o.status] ?? 'var(--text-muted)'}20`,
                  color:       STATUS_COLOR[o.status] ?? 'var(--text-muted)',
                  border:     `1px solid ${STATUS_COLOR[o.status] ?? 'var(--border-subtle)'}60`,
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
  );
}