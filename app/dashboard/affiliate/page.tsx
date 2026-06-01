// app/dashboard/affiliate/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import AffiliateButton from '@/components/AffiliateButton';
import toast from 'react-hot-toast';

interface Referral {
  id: string;
  name: string;
  ibiNumber: string;
  tier: string;
  commission: number;
  status: string;
  joinedAt: { seconds: number };
}

export default function AffiliatePage() {
  const { member } = useAuth();
  const [referrals, setReferrals]   = useState<Referral[]>([]);
  const [loading, setLoading]       = useState(true);
  const [totalEarned, setEarned]    = useState(0);
  const [pendingPay, setPending]    = useState(0);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!member) return;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'referrals'), where('referrerUid', '==', member.uid), orderBy('joinedAt', 'desc'))
        );
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Referral[];
        setReferrals(data);
        const total = data.reduce((s, r) => s + (r.commission ?? 0), 0);
        const pending = data.filter(r => r.status === 'pending').reduce((s, r) => s + (r.commission ?? 0), 0);
        setEarned(total);
        setPending(pending);
      } finally { setLoading(false); }
    })();
  }, [member]);

  const handleWithdraw = async () => {
    if (pendingPay < 500) { toast.error('Minimum withdrawal is ₦500'); return; }
    setWithdrawing(true);
    try {
      const res = await fetch('/api/affiliate/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: pendingPay }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`₦${pendingPay.toLocaleString()} moved to your IBI Wallet!`);
      setPending(0);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setWithdrawing(false); }
  };

  const COMMISSION_TABLE = [
    { tier: 'Associate',   amount: '₦500' },
    { tier: 'Full Member', amount: '₦1,500' },
    { tier: 'Lifetime',    amount: '₦5,000' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--ibi-gold)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Affiliate Program</div>
        <h2 style={{ marginBottom: 4 }}>Earn by Referring Members</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Share your link. When someone joins IBI, you earn a commission instantly to your wallet.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-md)' }}>
        {[
          { label: 'Total Referrals',   value: referrals.length,             icon: '👥', color: '#60a5fa' },
          { label: 'Total Earned',      value: `₦${totalEarned.toLocaleString()}`, icon: '💰', color: 'var(--ibi-gold)' },
          { label: 'Pending Payout',    value: `₦${pendingPay.toLocaleString()}`,  icon: '⏳', color: '#f472b6' },
          { label: 'Active Referrals',  value: referrals.filter(r => r.status === 'active').length, icon: '✅', color: '#4ade80' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="card">
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{icon}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Withdraw */}
      {pendingPay > 0 && (
        <div style={{
          padding: 'var(--space-lg)',
          background: 'rgba(212,175,55,0.06)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Pending commission ready to withdraw</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ibi-gold)' }}>
              ₦{pendingPay.toLocaleString()}
            </div>
          </div>
          <button
            className="btn btn-gold"
            onClick={handleWithdraw}
            disabled={withdrawing}
            style={{ gap: 8 }}
          >
            {withdrawing ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Moving…</> : '→ Move to Wallet'}
          </button>
        </div>
      )}

      {/* Affiliate link */}
      <AffiliateButton />

      {/* Commission table */}
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
          Commission Rates
        </div>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {COMMISSION_TABLE.map(({ tier, amount }, i) => (
            <div key={tier} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderBottom: i < COMMISSION_TABLE.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{tier}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ibi-gold)', fontSize: '0.95rem' }}>{amount}</span>
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
              No referrals yet. Share your link to start earning!
            </div>
          ) : (
            referrals.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                borderBottom: i < referrals.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.ibiNumber} · {r.tier}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: r.status === 'active' ? '#4ade80' : 'var(--text-muted)', fontSize: '0.88rem' }}>
                    ₦{(r.commission ?? 0).toLocaleString()}
                  </div>
                  <span className={`badge ${r.status === 'active' ? 'badge-green' : 'badge-gold'}`} style={{ fontSize: '0.6rem' }}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
