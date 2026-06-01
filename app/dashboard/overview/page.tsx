// app/dashboard/overview/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import AffiliateButton from '@/components/AffiliateButton';

interface Activity {
  id: string;
  type: string;
  amount?: number;
  description: string;
  createdAt: { seconds: number };
}

export default function OverviewPage() {
  const { member } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [affiliateStats, setAffiliateStats] = useState({ referrals: 0, earnings: 0 });

  useEffect(() => {
    if (!member) return;
    (async () => {
      try {
        const q = query(
          collection(db, 'transactions'),
          where('uid', '==', member.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const snap = await getDocs(q);
        setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Activity[]);

        const affSnap = await getDocs(
          query(collection(db, 'affiliateStats'), where('uid', '==', member.uid), limit(1))
        );
        if (!affSnap.empty) {
          const d = affSnap.docs[0].data();
          setAffiliateStats({ referrals: d.referrals ?? 0, earnings: d.earnings ?? 0 });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingActivity(false);
      }
    })();
  }, [member]);

  const QUICK_ACTIONS = [
    { label: 'Top Up Wallet',  href: '/dashboard/wallet',    icon: '➕', color: 'var(--ibi-gold)' },
    { label: 'View ID Card',   href: '/dashboard/idcard',    icon: '🪪', color: 'var(--ibi-red-light)' },
    { label: 'Invite Members', href: '/dashboard/affiliate', icon: '🔗', color: '#4ade80' },
    { label: 'Order IBI Card', href: '/dashboard/cards',     icon: '💳', color: '#60a5fa' },
    { label: 'Make Donation',  href: '/donate',              icon: '❤️', color: '#f472b6' },
    { label: 'Contact Support',href: '/contact',             icon: '💬', color: 'var(--text-muted)' },
  ];

  const STAT_CARDS = [
    {
      label: 'Wallet Balance',
      value: `₦${(member?.walletBalance ?? 0).toLocaleString()}`,
      icon: '💰',
      color: 'var(--ibi-gold)',
      href: '/dashboard/wallet',
    },
    {
      label: 'Referrals',
      value: affiliateStats.referrals,
      icon: '👥',
      color: '#4ade80',
      href: '/dashboard/affiliate',
    },
    {
      label: 'Affiliate Earnings',
      value: `₦${affiliateStats.earnings.toLocaleString()}`,
      icon: '🔗',
      color: '#60a5fa',
      href: '/dashboard/affiliate',
    },
    {
      label: 'Membership',
      value: member?.membershipTier ?? '—',
      icon: '🏅',
      color: 'var(--ibi-red-light)',
      href: '/membership',
    },
  ];

  const membershipExpiry = member?.expiresAt
    ? new Date(member.expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* Greeting */}
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--ibi-gold)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Welcome back
        </div>
        <h2 style={{ marginBottom: 4 }}>{member?.displayName} 👋</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          IBI Number: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ibi-gold)' }}>{member?.ibiNumber}</code>
          {' · '}{member?.chapterCode} Chapter
        </p>
        {member?.status === 'pending' && (
          <div style={{
            marginTop: 12,
            padding: '10px 16px',
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid var(--border-gold)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}>
            ⏳ Your membership is under review. You'll receive an SMS and email once approved.
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
        {STAT_CARDS.map(({ label, value, icon, color, href }) => (
          <Link key={label} href={href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontSize: '1.6rem' }}>{icon}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>
                {value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-xl)' }}>
        {/* Quick actions */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
            Quick Actions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {QUICK_ACTIONS.map(({ label, href, icon, color }) => (
              <Link
                key={label}
                href={href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  padding: 'var(--space-md)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
              >
                <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Recent Activity
            </div>
            <Link href="/dashboard/wallet" style={{ fontSize: '0.78rem', color: 'var(--ibi-gold)' }}>View all</Link>
          </div>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {loadingActivity ? (
              <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
                <div className="spinner" style={{ borderColor: 'var(--border-gold)', borderTopColor: 'var(--ibi-gold)', margin: '0 auto' }} />
              </div>
            ) : activities.length === 0 ? (
              <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No transactions yet
              </div>
            ) : (
              activities.map((act, i) => (
                <div key={act.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: i < activities.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{act.description}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {act.createdAt ? new Date(act.createdAt.seconds * 1000).toLocaleDateString() : ''}
                    </div>
                  </div>
                  {act.amount !== undefined && (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: act.type === 'credit' ? '#4ade80' : 'var(--ibi-red-light)',
                    }}>
                      {act.type === 'credit' ? '+' : '-'}₦{act.amount.toLocaleString()}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Membership card */}
      <div style={{
        padding: 'var(--space-lg)',
        background: 'linear-gradient(135deg, var(--ibi-red-dark) 0%, #2d0a12 100%)',
        border: '1px solid var(--border-red)',
        borderRadius: 'var(--radius-xl)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--space-md)',
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Membership Status</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            {member?.membershipTier?.toUpperCase()} MEMBER
          </div>
          {membershipExpiry && (
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>Expires: {membershipExpiry}</div>
          )}
        </div>
        <Link href="/membership" className="btn btn-gold btn-sm">Upgrade / Renew</Link>
      </div>

      {/* Affiliate quick link */}
      <AffiliateButton />
    </div>
  );
}
