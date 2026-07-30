// app/dashboard/affiliate/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import AffiliateButton from '@/components/AffiliateButton';
import toast from 'react-hot-toast';
import { usePricingSettings } from '@/lib/pricing';
import PinConfirmModal from '@/components/PinConfirmModal';

interface Referral {
  id: string; name: string; ibiNumber: string; tier: string;
  commission: number; status: string; joinedAt: { seconds: number };
}

export default function AffiliatePage() {
  const { member } = useAuth();
  const [referrals,   setReferrals]   = useState<Referral[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [totalEarned, setEarned]      = useState(0);
  const [pendingPay,  setPending]     = useState(0);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const { pricing } = usePricingSettings();

  useEffect(() => {
    if (!member || !db) { setLoading(false); return; }
    (async () => {
      try {
        // 1. Read referrals list (no orderBy — sort in JS)
        const refSnap = await getDocs(
          query(collection(db, 'referrals'), where('referrerUid', '==', member.uid))
        );
        const data = refSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Referral))
          .sort((a, b) => (b.joinedAt?.seconds ?? 0) - (a.joinedAt?.seconds ?? 0));
        setReferrals(data);

        // 2. Read affiliateStats doc — this is the authoritative earnings record
        // Try by uid field first (no-index query)
        const statsSnap = await getDocs(
          query(collection(db, 'affiliateStats'), where('uid', '==', member.uid))
        );

        if (!statsSnap.empty) {
          const s = statsSnap.docs[0].data();
          setEarned(typeof s.earnings === 'number' ? s.earnings : 0);
          // Pending = sum of pending referral commissions
          const pendingAmt = data
            .filter(r => r.status === 'pending')
            .reduce((sum, r) => sum + (r.commission ?? 0), 0);
          setPending(pendingAmt);
        } else {
          // Fallback: compute from referrals array directly
          const earned  = data.reduce((s, r) => s + (r.commission ?? 0), 0);
          const pending = data.filter(r => r.status === 'pending').reduce((s, r) => s + (r.commission ?? 0), 0);
          setEarned(earned);
          setPending(pending);
        }
      } catch (e: any) {
        console.error('[affiliate]', e.code, e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [member]);

  const handleWithdraw = async (pin: string) => {
    if (pendingPay < 500) { toast.error('Minimum withdrawal is ₦500'); return; }
    setWithdrawing(true);
    try {
      const res  = await fetch('/api/affiliate/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ amount: pendingPay, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`₦${pendingPay.toLocaleString()} moved to your IBI Wallet!`);
      setPending(0);
      setShowPinPrompt(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Withdrawal failed');
      throw e; // lets the PIN modal show the error inline and allow retry
    } finally {
      setWithdrawing(false);
    }
  };

  // Built entirely from admin-configurable settings (lib/pricing.ts, backed
  // by the Firestore settings/pricing doc) — nothing here is hardcoded, so
  // an admin editing that doc updates this table (and what's actually paid
  // out) sitewide, with no other file to touch.
  const { registrationFees: fees, commissionRate, marketplaceRate } = pricing;
  const commissionPct  = `${Math.round(commissionRate * 100)}%`;
  const marketplacePct = `${Math.round(marketplaceRate * 100)}%`;

  const COMMISSION_TABLE = [
    { tier: 'Student / Youth (FREE)',
      amount: '₦0',
      note: 'Free tier — no commission' },
    { tier: `Professional (₦${fees.professional.toLocaleString()})`,
      amount: `₦${Math.round(fees.professional * commissionRate).toLocaleString()}`,
      note: `${commissionPct} of registration fee` },
    { tier: `Business (₦${fees.business.toLocaleString()})`,
      amount: `₦${Math.round(fees.business * commissionRate).toLocaleString()}`,
      note: `${commissionPct} of registration fee` },
    { tier: `Diaspora ($${fees.diasporaUSD.toLocaleString()})`,
      amount: 'USD → NGN at IBI rate',
      note: `${commissionPct} converted instantly` },
    { tier: `Patron (₦${fees.patron.toLocaleString()})`,
      amount: `₦${Math.round(fees.patron * commissionRate).toLocaleString()}`,
      note: `${commissionPct} of registration fee` },
    { tier: 'IBI Marketplace sale',
      amount: `${marketplacePct} per sale`,
      note: 'On items sold via your link' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>

      <div>
        <div className="section-label">Affiliate Program</div>
        <h2 style={{ marginBottom: 4 }}>Earn by Referring Members</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Share your link. Earn commission for every paid activity you attract.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 'var(--space-md)' }}>
        {[
          { label: 'Total Referrals',  value: String(referrals.length),                     icon: '👥', color: '#60a5fa' },
          { label: 'Total Earned',     value: `₦${totalEarned.toLocaleString()}`,           icon: '💰', color: 'var(--ibi-gold)' },
          { label: 'Pending Payout',   value: `₦${pendingPay.toLocaleString()}`,             icon: '⏳', color: '#f472b6' },
          { label: 'Active Referrals', value: String(referrals.filter(r => r.status === 'active').length), icon: '✅', color: '#4ade80' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="card">
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{icon}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Withdraw pending */}
      {pendingPay > 0 && (
        <div style={{ padding: 'var(--space-lg)', background: 'rgba(212,175,55,0.06)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Pending commission ready to withdraw</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ibi-gold)' }}>₦{pendingPay.toLocaleString()}</div>
          </div>
          <button className="btn btn-gold" onClick={() => setShowPinPrompt(true)} disabled={withdrawing} style={{ gap: 8 }}>
            {withdrawing ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Moving…</> : '→ Move to Wallet'}
          </button>
        </div>
      )}

      {/* Affiliate link */}
      <AffiliateButton />

      {/* Commission rates */}
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>Commission Rates</div>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {COMMISSION_TABLE.map(({ tier, amount, note }, i) => (
            <div key={tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < COMMISSION_TABLE.length - 1 ? '1px solid var(--border-subtle)' : 'none', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{tier}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{note}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ibi-gold)', fontSize: '0.88rem', flexShrink: 0 }}>{amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Referral list */}
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
          Your Referrals ({referrals.length})
        </div>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
              <div className="spinner" style={{ borderColor: 'var(--border-gold)', borderTopColor: 'var(--ibi-gold)', margin: '0 auto' }} />
            </div>
          ) : referrals.length === 0 ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No referrals yet — share your affiliate link to start earning!
            </div>
          ) : (
            referrals.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < referrals.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {r.ibiNumber} · {r.tier}
                    {r.joinedAt ? ` · ${new Date(r.joinedAt.seconds * 1000).toLocaleDateString()}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.88rem', color: r.status === 'active' ? '#4ade80' : 'var(--text-muted)' }}>
                    ₦{(r.commission ?? 0).toLocaleString()}
                  </div>
                  <span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-gold'}`} style={{ fontSize: '0.6rem', textTransform: 'capitalize' }}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showPinPrompt && (
        <PinConfirmModal
          title="Enter your PIN to withdraw"
          subtitle={`Confirms moving ₦${pendingPay.toLocaleString()} to your IBI Wallet.`}
          onConfirm={handleWithdraw}
          onCancel={() => setShowPinPrompt(false)}
        />
      )}

    </div>
  );
}
