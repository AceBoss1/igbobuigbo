// app/dashboard/overview/page.tsx
'use client';
import { useEffect, useState }             from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import Link                                from 'next/link';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db }            from '@/lib/firebase';
import { useAuth }       from '@/lib/AuthContext';
import AffiliateButton   from '@/components/AffiliateButton';
import UpgradeTierModal  from '@/components/dashboard/UpgradeTierModal';
import DonateModal       from '@/components/dashboard/DonateModal';
import PinGateModal      from '@/components/dashboard/PinGateModal';
import { getClientPinMode, scaleForDisplay, type PinMode } from '@/lib/pinSessionClient';

interface Activity {
  id: string; type: string; amount?: number;
  description: string; createdAt: { seconds: number };
}

export default function OverviewPage() {
  const { member }         = useAuth();
  const [pinMode, setPinMode]         = useState<PinMode>(null);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  useEffect(() => {
    const existing = getClientPinMode();
    if (existing) { setPinMode(existing); setPinUnlocked(true); }
  }, []);
  const displayBalance = scaleForDisplay(member?.walletBalance ?? 0, pinMode);

  const [activities,       setActivities]       = useState<Activity[]>([]);
  const [loadingActivity,  setLoadingActivity]  = useState(true);
  const [affiliateStats,   setAffiliateStats]   = useState({ referrals:0, earnings:0 });
  const [showUpgrade,      setShowUpgrade]      = useState(false);
  const [showDonate,       setShowDonate]        = useState(false);

  useEffect(() => {
    if (!member || !db) return;
    (async () => {
      try {
        // NO orderBy — avoids Firestore composite index requirement.
        // We fetch last 50 and sort client-side, then slice to 5.
        const snap = await getDocs(query(
          collection(db, 'transactions'),
          where('uid', '==', member.uid),
          limit(50),
        ));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Activity[];
        all.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setActivities(all.slice(0, 5));

        // Affiliate stats
        const affSnap = await getDocs(query(
          collection(db, 'affiliateStats'),
          where('uid', '==', member.uid),
          limit(1),
        ));
        if (!affSnap.empty) {
          const d = affSnap.docs[0].data();
          setAffiliateStats({ referrals: d.referrals ?? 0, earnings: d.earnings ?? 0 });
        }
      } catch (e) { console.error('Overview load error:', e); }
      finally   { setLoadingActivity(false); }
    })();
  }, [member]);

  const QUICK_ACTIONS: { label: string; href?: string; onClick?: () => void; icon: string; color: string }[] = [
    { label:'Top Up Wallet',  href:'/dashboard/wallet',    icon:'➕', color:'var(--ibi-gold)' },
    { label:'View ID Card',   href:'/dashboard/idcard',    icon:'🪪', color:'var(--ibi-red-light)' },
    { label:'Invite Members', href:'/dashboard/affiliate', icon:'🔗', color:'#4ade80' },
    { label:'Order IBI Card', href:'/dashboard/cards',     icon:'💳', color:'#60a5fa' },
    { label:'Make Donation',  onClick:() => setShowDonate(true), icon:'❤️', color:'#f472b6' },
    { label:'Contact Support',href:'/contact',             icon:'💬', color:'var(--text-muted)' },
  ];

  const membershipExpiry = member?.expiresAt
    ? new Date(member.expiresAt).toLocaleDateString('en-NG',{ day:'numeric', month:'long', year:'numeric' })
    : null;

  return (
    <>
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xl)' }}>

        {/* Greeting */}
        <div>
          <div style={{ fontSize:'0.75rem', color:'var(--ibi-gold)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>
            Welcome back
          </div>
          <h2 style={{ marginBottom:4 }}>{member?.displayName} 👋</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>
            IBI Number: <code style={{ fontFamily:'var(--font-mono)', color:'var(--ibi-gold)' }}>{member?.ibiNumber}</code>
            {' · '}{member?.chapterCode} Chapter
          </p>
          {member?.status === 'pending' && (
            <div style={{ marginTop:12, padding:'10px 16px', background:'rgba(212,175,55,0.08)', border:'1px solid var(--border-gold)', borderRadius:'var(--radius-md)', fontSize:'0.85rem', color:'var(--text-secondary)' }}>
              ⏳ Your membership is under review. You'll receive an SMS and email once approved.
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'var(--space-md)' }}>
          <Link href="/dashboard/wallet" style={{ textDecoration:'none' }}>
            <StatCard icon="💰" value={`₦${pinUnlocked ? displayBalance.toLocaleString() : '••••.••'}`} label="Wallet Balance" color="var(--ibi-gold)" />
          </Link>
          <Link href="/dashboard/affiliate" style={{ textDecoration:'none' }}>
            <StatCard icon="👥" value={affiliateStats.referrals} label="Referrals" color="#4ade80" />
          </Link>
          <Link href="/dashboard/affiliate" style={{ textDecoration:'none' }}>
            <StatCard icon="🔗" value={`₦${scaleForDisplay(affiliateStats.earnings, pinMode).toLocaleString()}`} label="Affiliate Earnings" color="#60a5fa" />
          </Link>
          {/* Membership card opens upgrade modal — no /membership redirect */}
          <div onClick={() => setShowUpgrade(true)} style={{ cursor:'pointer' }}>
            <StatCard icon="🏅" value={<span style={{ textTransform:'capitalize' }}>{member?.membershipTier ?? '—'}</span>} label="Membership" color="var(--ibi-red-light)" action="↑ Upgrade" />
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'var(--space-xl)' }}>

          {/* Quick actions */}
          <div>
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'var(--space-md)' }}>
              Quick Actions
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {QUICK_ACTIONS.map(({ label, href, onClick, icon, color }) => {
                const tileStyle: CSSProperties = {
                  display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                  padding:'var(--space-md)', background:'var(--bg-elevated)',
                  border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)',
                  textDecoration:'none', transition:'all 0.2s', textAlign:'center',
                  cursor:'pointer', width:'100%', font:'inherit',
                };
                const hoverProps = {
                  onMouseEnter: (e: MouseEvent) => { const el=e.currentTarget as HTMLElement; el.style.borderColor=color; el.style.background='var(--bg-card)'; },
                  onMouseLeave: (e: MouseEvent) => { const el=e.currentTarget as HTMLElement; el.style.borderColor='var(--border-subtle)'; el.style.background='var(--bg-elevated)'; },
                };
                const inner = (
                  <>
                    <span style={{ fontSize:'1.5rem' }}>{icon}</span>
                    <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)', fontWeight:500, lineHeight:1.3 }}>{label}</span>
                  </>
                );
                // "Make Donation" opens the in-dashboard modal instead of
                // navigating to /donate — keeps the member in the dashboard.
                return onClick ? (
                  <button key={label} onClick={onClick} style={tileStyle} {...hoverProps}>{inner}</button>
                ) : (
                  <Link key={label} href={href!} style={tileStyle} {...hoverProps}>{inner}</Link>
                );
              })}
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'var(--space-md)' }}>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>
                Recent Activity
              </div>
              <Link href="/dashboard/wallet" style={{ fontSize:'0.78rem', color:'var(--ibi-gold)' }}>View all</Link>
            </div>
            <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border-subtle)', overflow:'hidden' }}>
              {loadingActivity ? (
                <div style={{ padding:'var(--space-xl)', textAlign:'center' }}>
                  <div className="spinner" style={{ borderColor:'var(--border-gold)', borderTopColor:'var(--ibi-gold)', margin:'0 auto' }} />
                </div>
              ) : activities.length === 0 ? (
                <div style={{ padding:'var(--space-xl)', textAlign:'center', color:'var(--text-muted)', fontSize:'0.88rem' }}>
                  No transactions yet
                </div>
              ) : activities.map((act, i) => (
                <div key={act.id} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'12px 16px',
                  borderBottom: i < activities.length-1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize:'0.85rem', color:'var(--text-primary)', fontWeight:500 }}>{act.description}</div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                      {act.createdAt ? new Date(act.createdAt.seconds*1000).toLocaleDateString() : ''}
                    </div>
                  </div>
                  {act.amount !== undefined && (
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.88rem', fontWeight:700, color: act.type==='credit' ? '#4ade80' : 'var(--ibi-red-light)' }}>
                      {act.type==='credit' ? '+' : '-'}₦{scaleForDisplay(act.amount, pinMode).toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Membership status card — button opens modal, not /membership */}
        <div style={{
          padding:'var(--space-lg)',
          background:'linear-gradient(135deg,var(--ibi-red-dark) 0%,#2d0a12 100%)',
          border:'1px solid var(--border-red)', borderRadius:'var(--radius-xl)',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          flexWrap:'wrap', gap:'var(--space-md)',
        }}>
          <div>
            <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.6)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>
              Membership Status
            </div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', fontWeight:700, color:'#fff', marginBottom:4, textTransform:'uppercase' }}>
              {member?.membershipTier} MEMBER
            </div>
            {membershipExpiry && (
              <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.6)' }}>Expires: {membershipExpiry}</div>
            )}
          </div>
          <button onClick={() => setShowUpgrade(true)} className="btn btn-gold btn-sm">
            ↑ Upgrade / Renew
          </button>
        </div>

        <AffiliateButton />
      </div>

      {!pinUnlocked && <PinGateModal onUnlock={(mode) => { setPinMode(mode); setPinUnlocked(true); }} />}
      {showUpgrade && <UpgradeTierModal onClose={() => setShowUpgrade(false)} />}
      {showDonate  && <DonateModal onClose={() => setShowDonate(false)} />}
    </>
  );
}

function StatCard({ icon, value, label, color, action }: {
  icon:string; value:React.ReactNode; label:string; color:string; action?:string;
}) {
  return (
    <div className="card" style={{ cursor:'pointer' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <span style={{ fontSize:'1.6rem' }}>{icon}</span>
        {action ? (
          <span style={{ fontSize:'0.7rem', fontWeight:700, color, background:`${color}15`, padding:'2px 8px', borderRadius:99, border:`1px solid ${color}40` }}>
            {action}
          </span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        )}
      </div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.3rem', fontWeight:700, color, lineHeight:1, marginBottom:6 }}>
        {value}
      </div>
      <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
        {label}
      </div>
    </div>
  );
}
