// components/dashboard/UpgradeTierModal.tsx
'use client';
import { useState } from 'react';
import { useAuth }  from '@/lib/AuthContext';
import { usePricingSettings, type RegistrationFees } from '@/lib/pricing';
import toast        from 'react-hot-toast';
import PinConfirmModal from '@/components/PinConfirmModal';

// Built from admin-configurable settings/pricing (lib/pricing.ts) — the
// same source used by the membership page and affiliate commission table,
// so a fee change stays in sync everywhere without touching this file.
function buildAllTiers(fees: RegistrationFees) {
  return [
    { id:'student',      name:'Student',        price:0,                currency:'₦', label:'FREE',                              order:0 },
    { id:'youth',        name:'Youth (18–35)',  price:0,                currency:'₦', label:'FREE',                              order:1 },
    { id:'professional', name:'Professional',   price:fees.professional, currency:'₦', label:`₦${fees.professional.toLocaleString()}`, order:2 },
    { id:'business',     name:'Business',       price:fees.business,     currency:'₦', label:`₦${fees.business.toLocaleString()}`,     order:3 },
    { id:'diaspora',     name:'Diaspora',       price:fees.diasporaUSD,  currency:'$', label:`$${fees.diasporaUSD}`,                    order:3 },
    { id:'patron',       name:'Patron',         price:fees.patron,       currency:'₦', label:`₦${fees.patron.toLocaleString()}`,        order:4 },
  ];
}

const TIER_PERKS: Record<string, string[]> = {
  professional: ['IBI NGN + USD Wallet','Business Listing','FREE Virtual IBI Debit Card','Apply to be voted for','5 Free verification tokens/yr','Post jobs on Job Board','Vote weight × 5'],
  business:     ['Everything in Professional','Premium business directory listing','Priority job board placement','Higher community standing'],
  diaspora:     ['Everything in Professional','Diaspora network access','USD wallet included','Vote weight × 5'],
  patron:       ['All Full Member Perks','Priority VIP Support','Lifetime ID Card','VIP Gold/Black debit cards eligible','Annual Summit Access','Vote weight × 10','Executive Recognition'],
};

type PayMethod = 'paystack' | 'wallet';

function getUpgrades(allTiers: ReturnType<typeof buildAllTiers>, currentTierId: string) {
  const current = allTiers.find(t => t.id === currentTierId);
  if (!current) return allTiers.filter(t => t.price > 0);
  return allTiers.filter(t => t.order > current.order);
}

interface Props { onClose: () => void; }

export default function UpgradeTierModal({ onClose }: Props) {
  const { member, refreshMember } = useAuth();
  const { pricing } = usePricingSettings();
  const ALL_TIERS   = buildAllTiers(pricing.registrationFees);
  const [selected,   setSelected]   = useState<ReturnType<typeof buildAllTiers>[0] | null>(null);
  const [payMethod,  setPayMethod]  = useState<PayMethod>('paystack');
  const [paying,     setPaying]     = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);

  const currentTier = ALL_TIERS.find(t => t.id === member?.membershipTier) ?? ALL_TIERS[1];
  const upgrades    = getUpgrades(ALL_TIERS, currentTier.id);
  const balance     = member?.walletBalance ?? 0;
  const canPayWallet = selected && selected.currency === '₦' && balance >= selected.price;

  // ── Payment handlers ────────────────────────────────────────────────────────

  const handlePaystack = async () => {
    if (!selected || !member) return;
    setPaying(true);
    const ref = `IBI-UPG-${Date.now()}`;
    try {
      const { openPaystack } = await import('@/lib/paystack-inline');
      await openPaystack({
        email:    member.email,
        amount:   selected.price * 100,
        currency: selected.currency === '$' ? 'USD' : 'NGN',
        ref,
        metadata: { uid: member.uid, tier: selected.id, upgrade: true },
        onSuccess: async (res: any) => {
          await verifyUpgrade(res.reference, 'paystack');
          setPaying(false);
        },
        onClose: () => setPaying(false),
      });
    } catch (e: any) {
      setPaying(false);
      toast.error(e.message ?? 'Could not open Paystack');
    }
  };

  const handleWallet = async (pin: string) => {
    if (!selected || !member || !canPayWallet) return;
    setPaying(true);
    try {
      const res = await fetch('/api/membership/upgrade', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier: selected.id, method: 'wallet', pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refreshMember();
      toast.success(`🎉 Upgraded to ${selected.name}! ₦${selected.price.toLocaleString()} deducted from wallet.`);
      setShowPinPrompt(false);
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Wallet upgrade failed');
      throw e; // let the PIN modal show the error inline too, so a wrong PIN can be retried without reopening this whole modal
    } finally { setPaying(false); }
  };

  const verifyUpgrade = async (reference: string, method: string) => {
    try {
      const res = await fetch('/api/membership/upgrade', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reference, tier: selected!.id, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refreshMember();
      toast.success(`🎉 Upgraded to ${selected!.name}!`);
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Upgrade verification failed');
    }
  };

  const handlePay = () => payMethod === 'wallet' ? setShowPinPrompt(true) : handlePaystack();

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.72)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div style={{
        background:'var(--bg-elevated)', border:'1px solid var(--border-gold)',
        borderRadius:'var(--radius-xl)', width:'100%', maxWidth:600,
        maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--grad-card)', flexShrink:0 }}>
          <div>
            <h3 style={{ margin:0, fontSize:'1rem' }}>Upgrade Membership</h3>
            <p style={{ margin:'3px 0 0', fontSize:'0.78rem', color:'var(--text-muted)' }}>
              Current: <span style={{ color:'var(--ibi-gold)', fontWeight:600 }}>{currentTier.name}</span>
              {currentTier.price > 0 ? ` (${currentTier.label} lifetime)` : ' (Free)'}
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:22, cursor:'pointer', padding:'2px 6px' }}>×</button>
        </div>

        {/* Tier list */}
        <div style={{ overflowY:'auto', flex:1, padding:'var(--space-lg)' }}>
          {upgrades.length === 0 ? (
            <div style={{ textAlign:'center', padding:'var(--space-xl)', color:'var(--text-muted)' }}>
              <div style={{ fontSize:'2rem', marginBottom:12 }}>🏆</div>
              <p style={{ fontWeight:600, color:'var(--text-primary)' }}>You are already a {currentTier.name}!</p>
              <p style={{ fontSize:'0.85rem' }}>You are at the highest available membership tier.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {upgrades.map(tier => {
                const isSelected = selected?.id === tier.id;
                const color = tier.id === 'patron' ? 'var(--ibi-red-light)' : tier.currency === '$' ? '#60a5fa' : 'var(--ibi-gold)';
                const perks = TIER_PERKS[tier.id] ?? [];

                return (
                  <div key={tier.id} onClick={() => setSelected(tier)} style={{
                    border:`2px solid ${isSelected ? color : 'var(--border-subtle)'}`,
                    borderRadius:'var(--radius-lg)', padding:'var(--space-md)',
                    cursor:'pointer', transition:'all 0.2s',
                    background: isSelected ? 'rgba(212,175,55,0.05)' : 'var(--bg-card)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${isSelected ? color : 'var(--border-subtle)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {isSelected && <div style={{ width:9, height:9, borderRadius:'50%', background:color }} />}
                        </div>
                        <div>
                          <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:'0.95rem' }}>{tier.name}</div>
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>One-Time · Lifetime</div>
                        </div>
                      </div>
                      <div style={{ fontFamily:'var(--font-mono)', fontWeight:800, fontSize:'1.1rem', color }}>{tier.label}</div>
                    </div>
                    {perks.length > 0 && (
                      <ul style={{ listStyle:'none', padding:'6px 0 0 28px', margin:0, display:'flex', flexDirection:'column', gap:4 }}>
                        {perks.map(p => (
                          <li key={p} style={{ display:'flex', gap:7, fontSize:'0.78rem', color:'var(--text-secondary)' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ flexShrink:0, marginTop:2 }}><polyline points="20,6 9,17 4,12"/></svg>
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment method + action */}
        {upgrades.length > 0 && selected && (
          <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border-subtle)', background:'var(--bg-elevated)', flexShrink:0 }}>

            {/* Payment method tabs — only show wallet if Naira tier */}
            {selected.currency === '₦' && (
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                {(['paystack','wallet'] as PayMethod[]).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)} style={{
                    flex:1, padding:'8px 12px', borderRadius:'var(--radius-md)', cursor:'pointer',
                    fontSize:'0.8rem', fontWeight:600,
                    background: payMethod === m ? 'rgba(212,175,55,0.1)' : 'var(--bg-card)',
                    border:`1px solid ${payMethod === m ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`,
                    color: payMethod === m ? 'var(--ibi-gold)' : 'var(--text-muted)',
                    transition:'all 0.15s',
                  }}>
                    {m === 'paystack' ? '💳 Card / Bank / USSD' : '💰 IBI Wallet'}
                  </button>
                ))}
              </div>
            )}

            {/* Wallet balance info */}
            {payMethod === 'wallet' && (
              <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.8rem' }}>
                <span style={{ color:'var(--text-muted)' }}>Wallet balance</span>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color: canPayWallet ? '#4ade80' : 'var(--ibi-red-light)' }}>
                  ₦{balance.toLocaleString()}
                  {!canPayWallet && selected && <span style={{ color:'var(--ibi-red-light)', marginLeft:8, fontSize:'0.72rem' }}>Insufficient (need ₦{(selected.price - balance).toLocaleString()} more)</span>}
                </span>
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handlePay} disabled={paying || (payMethod === 'wallet' && !canPayWallet)}
                className="btn btn-gold"
                style={{ flex:1, justifyContent:'center', gap:10, opacity: (payMethod === 'wallet' && !canPayWallet) ? 0.5 : 1 }}>
                {paying
                  ? <><span className="spinner" style={{ width:16, height:16 }} /> Processing…</>
                  : `Upgrade to ${selected.name} — ${selected.label}`}
              </button>
              <button onClick={onClose} className="btn" style={{ flexShrink:0, background:'var(--bg-card)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {showPinPrompt && selected && (
        <PinConfirmModal
          title="Enter your PIN to upgrade"
          subtitle={`Confirms paying ${selected.label} from your IBI wallet.`}
          onConfirm={handleWallet}
          onCancel={() => setShowPinPrompt(false)}
        />
      )}
    </div>
  );
}
