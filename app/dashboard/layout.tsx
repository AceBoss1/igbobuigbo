// app/dashboard/layout.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import Link                             from 'next/link';
import { usePathname, useRouter }       from 'next/navigation';
import { useAuth }                      from '@/lib/AuthContext';
import { signOut }                      from 'firebase/auth';
import { auth }                         from '@/lib/firebase';
import UpgradeTierModal                 from '@/components/dashboard/UpgradeTierModal';
import DonateModal                      from '@/components/dashboard/DonateModal';
import VerifyEmailBanner                from '@/components/dashboard/VerifyEmailBanner';
import NotificationBell                 from '@/components/dashboard/NotificationBell';

const NAV_SECTIONS = [
  {
    label: 'MAIN',
    items: [
      { href:'/dashboard/overview',  icon:'⬡',  label:'Overview'   },
      { href:'/dashboard/profile',   icon:'👤', label:'My Profile' },
      { href:'/dashboard/idcard',    icon:'🪪',  label:'ID Card'    },
      { href:'/dashboard/wallet',    icon:'💰',  label:'Wallet'     },
    ],
  },
  {
    label: 'PROGRAMS',
    items: [
      { href:'/dashboard/affiliate', icon:'🔗',  label:'Affiliate'  },
      { href:'/dashboard/cards',     icon:'💳',  label:'IBI Cards'  },
      { href:'/dashboard/transfer',  icon:'↔️',  label:'Transfer'   },
    ],
  },
];

const HEADER_H = 64;

// ─── Avatar — always uses <img> so photoURL loads and logo.svg always visible ─
function Avatar({ photoURL, name, size = 34 }: { photoURL?: string | null; name?: string | null; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() ?? 'M';
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      border:'2px solid var(--ibi-gold)',
      overflow:'hidden', flexShrink:0,
      background:'var(--grad-red)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize: size * 0.33, fontWeight:700, color:'#fff',
    }}>
      {photoURL && !imgErr
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photoURL} alt={name ?? 'avatar'} width={size} height={size}
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            onError={() => setImgErr(true)} />
        : initials}
    </div>
  );
}

// ─── IBI Logo — always uses <img src="/logo.svg"> ─────────────────────────────
function IBILogo({ size = 42 }: { size?: number }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      border:'2px solid var(--ibi-gold)',
      overflow:'hidden', flexShrink:0, background:'#8B1A1A',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="IBI" width={size} height={size}
        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
    </div>
  );
}

// ─── Profile dropdown ─────────────────────────────────────────────────────────
function ProfileDropdown({ onUpgrade, onDonate }: { onUpgrade: () => void; onDonate: () => void }) {
  const { member, user } = useAuth();
  const router           = useRouter();
  const [open, setOpen]  = useState(false);
  const ref              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const close = () => setOpen(false);

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display:'flex', alignItems:'center', gap:10,
        background:'rgba(255,255,255,0.06)', border:'1px solid var(--border-gold)',
        borderRadius:'var(--radius-full)', padding:'5px 14px 5px 6px',
        cursor:'pointer', color:'var(--text-primary)', transition:'background 0.15s',
      }}>
        <Avatar photoURL={member?.photoURL} name={member?.displayName ?? user?.displayName} size={34} />
        <div style={{ textAlign:'left', lineHeight:1.25 }}>
          <div style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-primary)', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {member?.displayName ?? user?.displayName ?? 'Member'}
          </div>
          <div style={{ fontSize:'0.65rem', color:'var(--ibi-gold)', fontFamily:'var(--font-mono)' }}>
            {member?.ibiNumber ?? 'Pending'}
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0, transition:'transform 0.2s', transform:open?'rotate(180deg)':'none' }}>
          <path d="M2 4l4 4 4-4" stroke="var(--ibi-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:200,
          background:'var(--bg-elevated)', border:'1px solid var(--border-gold)',
          borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)',
          minWidth:230, overflow:'hidden',
        }}>
          {/* Member info */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-subtle)', background:'var(--grad-card)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Avatar photoURL={member?.photoURL} name={member?.displayName} size={38} />
              <div>
                <div style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-primary)' }}>{member?.displayName}</div>
                <div style={{ fontSize:'0.68rem', color:'var(--ibi-gold)', fontFamily:'var(--font-mono)', marginTop:1 }}>{member?.ibiNumber}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <span className={`badge ${member?.status==='active'?'badge-green':'badge-gold'}`} style={{ fontSize:'0.6rem' }}>
                {member?.status==='active' ? '● Active' : '● Pending'}
              </span>
              <span className="badge badge-gold" style={{ fontSize:'0.6rem', textTransform:'capitalize' }}>
                {member?.membershipTier}
              </span>
            </div>
          </div>

          {/* Wallet */}
          <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Wallet Balance</span>
            <span style={{ fontSize:'0.82rem', fontWeight:700, color:'var(--ibi-gold)', fontFamily:'var(--font-mono)' }}>
              ₦{(member?.walletBalance ?? 0).toLocaleString()}
            </span>
          </div>

          {/* Nav links */}
          {[
            { href:'/dashboard/profile',   label:'👤  My Profile'   },
            { href:'/dashboard/wallet',    label:'💰  Wallet'        },
            { href:'/dashboard/idcard',    label:'🪪   ID Card'       },
            { href:'/dashboard/affiliate', label:'🔗  Affiliate'     },
            { href:'/dashboard/cards',     label:'💳  IBI Cards'     },
            { href:'/contact',             label:'💬  Support'       },
          ].map(item => (
            <Link key={item.href} href={item.href} onClick={close} style={{
              display:'block', padding:'9px 16px',
              color:'var(--text-secondary)', fontSize:'0.82rem',
              textDecoration:'none', borderBottom:'1px solid var(--border-subtle)',
            }}>
              {item.label}
            </Link>
          ))}

          <button onClick={() => { close(); onUpgrade(); }} style={{
            display:'block', width:'100%', padding:'9px 16px',
            color:'var(--ibi-gold)', fontSize:'0.82rem', fontWeight:600,
            textAlign:'left', background:'rgba(212,175,55,0.05)',
            border:'none', borderBottom:'1px solid var(--border-subtle)', cursor:'pointer',
          }}>
            ↑  Upgrade Tier
          </button>

          <button onClick={() => { close(); onDonate(); }} style={{
            display:'block', width:'100%', padding:'9px 16px',
            color:'var(--ibi-red-light)', fontSize:'0.82rem', fontWeight:600,
            textAlign:'left', background:'rgba(200,16,46,0.05)',
            border:'none', borderBottom:'1px solid var(--border-subtle)', cursor:'pointer',
          }}>
            💛  Donate
          </button>

          <Link href="/" onClick={close} style={{ display:'block', padding:'9px 16px', color:'var(--text-secondary)', fontSize:'0.82rem', textDecoration:'none', borderBottom:'1px solid var(--border-subtle)' }}>
            🏠  Back to Home
          </Link>

          <button onClick={async () => { close(); if (auth) await signOut(auth); router.push('/'); }} style={{
            display:'block', width:'100%', padding:'9px 16px',
            color:'var(--ibi-red-light)', fontSize:'0.82rem',
            textAlign:'left', background:'transparent', border:'none', cursor:'pointer',
          }}>
            ⏻  Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard header ─────────────────────────────────────────────────────────
function DashboardHeader({ onUpgrade, onDonate }: { onUpgrade: () => void; onDonate: () => void }) {
  return (
    <header style={{
      position:'fixed', top:0, left:0, right:0, height:HEADER_H,
      background:'var(--bg-secondary)', borderBottom:'1px solid var(--border-subtle)',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 var(--space-lg)', zIndex:100,
      backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)',
    }}>
      {/* LEFT: IBI logo (always /logo.svg) + org name */}
      <Link href="/" style={{ display:'flex', alignItems:'center', gap:12, textDecoration:'none' }}>
        <IBILogo size={42} />
        <div>
          <div style={{ fontSize:'1rem', fontWeight:800, color:'var(--text-primary)', letterSpacing:'0.05em', fontFamily:'var(--font-display)', lineHeight:1.1 }}>
            Igbo Bu Igbo
          </div>
          <div style={{ fontSize:'0.55rem', color:'var(--ibi-gold)', letterSpacing:'0.12em', textTransform:'uppercase', lineHeight:1.2 }}>
            Unity &amp; Cultural Preservation Initiative
          </div>
        </div>
      </Link>

      {/* RIGHT: Notification bell + profile dropdown with member avatar */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <NotificationBell />
        <ProfileDropdown onUpgrade={onUpgrade} onDonate={onDonate} />
      </div>
    </header>
  );
}

// ─── Dashboard footer ─────────────────────────────────────────────────────────
function DashboardFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ borderTop:'1px solid var(--border-subtle)', padding:'14px var(--space-lg)', background:'var(--bg-secondary)', textAlign:'center' }}>
      <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', margin:'0 0 4px' }}>
        © {year} Igbo Bu Igbo Unity and Cultural Preservation Initiative. All rights reserved.
      </p>
      <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', margin:0, display:'flex', alignItems:'center', justifyContent:'center', gap:8, flexWrap:'wrap' }}>
        <span>Developed by{' '}
          <a href="https://www.adams.com.ng/" target="_blank" rel="noopener noreferrer" style={{ color:'var(--ibi-gold)', textDecoration:'none', fontWeight:500 }}>
            Adams Consults
          </a>
        </span>
        <span style={{ color:'var(--border-subtle)' }}>|</span>
        <Link href="/privacy" style={{ color:'var(--text-muted)', textDecoration:'none' }}>Privacy Policy</Link>
        <span style={{ color:'var(--border-subtle)' }}>|</span>
        <Link href="/terms" style={{ color:'var(--text-muted)', textDecoration:'none' }}>Terms of Use</Link>
        <span style={{ color:'var(--border-subtle)' }}>|</span>
        <a href="https://igbobuigbo.org.ng" target="_blank" rel="noopener noreferrer" style={{ color:'var(--text-muted)', textDecoration:'none' }}>
          igbobuigbo.org.ng
        </a>
      </p>
    </footer>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, member, loading } = useAuth();
  const router                    = useRouter();
  const pathname                  = usePathname();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showDonate,  setShowDonate]  = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      // Same mechanism as middleware.ts — carry the destination via cookie,
      // not a query string, to avoid the class of production-only URL
      // mangling that caused the %2F redirect bug.
      document.cookie = `ibi_redirect_next=${pathname}; path=/; max-age=300; samesite=lax`;
      router.replace('/login');
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div className="spinner" style={{ width:40, height:40, borderColor:'var(--border-gold)', borderTopColor:'var(--ibi-gold)', margin:'0 auto 16px' }} />
          <p style={{ color:'var(--text-muted)' }}>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const allItems = NAV_SECTIONS.flatMap(s => s.items);

  return (
    <>
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>
        <DashboardHeader onUpgrade={() => setShowUpgrade(true)} onDonate={() => setShowDonate(true)} />

        <div style={{ display:'flex', flex:1, paddingTop:HEADER_H }}>

          {/* Sidebar */}
          <aside style={{
            width:240, flexShrink:0, background:'var(--bg-secondary)',
            borderRight:'1px solid var(--border-subtle)',
            position:'sticky', top:HEADER_H, height:`calc(100vh - ${HEADER_H}px)`,
            overflowY:'auto', padding:'var(--space-md)',
            display:'flex', flexDirection:'column', gap:'var(--space-md)',
          }} className="hide-mobile">

            {/* Member card in sidebar — uses <img> Avatar */}
            <div style={{ padding:'var(--space-md)', background:'var(--grad-card)', border:'1px solid var(--border-gold)', borderRadius:'var(--radius-lg)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <Avatar photoURL={member?.photoURL} name={member?.displayName ?? user.displayName} size={40} />
                <div style={{ overflow:'hidden' }}>
                  <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {member?.displayName ?? user.displayName ?? 'Member'}
                  </div>
                  <div style={{ fontSize:'0.65rem', color:'var(--ibi-gold)', fontFamily:'var(--font-mono)' }}>
                    {member?.ibiNumber ?? 'Pending'}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'var(--bg-card)', borderRadius:'var(--radius-md)', marginBottom:8 }}>
                <span style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>Wallet</span>
                <span style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--ibi-gold)', fontFamily:'var(--font-mono)' }}>
                  ₦{(member?.walletBalance ?? 0).toLocaleString()}
                </span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <span className={`badge ${member?.status==='active'?'badge-green':'badge-gold'}`} style={{ fontSize:'0.6rem' }}>
                  {member?.status==='active' ? '● Active' : '● Pending'}
                </span>
                <span className="badge badge-gold" style={{ fontSize:'0.6rem', textTransform:'capitalize' }}>{member?.membershipTier}</span>
              </div>
            </div>

            {/* Nav sections */}
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                <div style={{ fontSize:'0.62rem', color:'var(--text-muted)', fontWeight:700, letterSpacing:'0.1em', padding:'0 8px', marginBottom:6 }}>
                  {section.label}
                </div>
                {section.items.map(({ href, icon, label }) => {
                  const active = pathname === href || pathname.startsWith(href+'/');
                  return (
                    <Link key={href} href={href} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                      borderRadius:'var(--radius-md)', marginBottom:2,
                      background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
                      border:`1px solid ${active ? 'var(--border-gold)' : 'transparent'}`,
                      color: active ? 'var(--ibi-gold)' : 'var(--text-secondary)',
                      textDecoration:'none', fontSize:'0.86rem', fontWeight: active ? 600 : 400,
                      transition:'all 0.15s',
                    }}>
                      <span>{icon}</span>{label}
                    </Link>
                  );
                })}
              </div>
            ))}

            {/* Sidebar bottom */}
            <div style={{ marginTop:'auto', paddingTop:'var(--space-md)', borderTop:'1px solid var(--border-subtle)', display:'flex', flexDirection:'column', gap:2 }}>
              <button onClick={() => setShowUpgrade(true)} style={{ display:'block', width:'100%', padding:'8px 12px', borderRadius:'var(--radius-md)', color:'var(--ibi-gold)', fontSize:'0.8rem', fontWeight:600, textAlign:'left', background:'transparent', border:'none', cursor:'pointer' }}>
                ↑ Upgrade Tier
              </button>
              <button onClick={() => setShowDonate(true)} style={{ display:'block', width:'100%', padding:'8px 12px', borderRadius:'var(--radius-md)', color:'var(--ibi-red-light)', fontSize:'0.8rem', fontWeight:600, textAlign:'left', background:'transparent', border:'none', cursor:'pointer' }}>
                💛 Donate
              </button>
              <Link href="/contact" style={{ display:'block', padding:'8px 12px', borderRadius:'var(--radius-md)', color:'var(--text-muted)', fontSize:'0.8rem', textDecoration:'none' }}>
                💬 Support
              </Link>
              <Link href="/" style={{ display:'block', padding:'8px 12px', borderRadius:'var(--radius-md)', color:'var(--text-muted)', fontSize:'0.8rem', textDecoration:'none' }}>
                🏠 Back to Home
              </Link>
              <button onClick={async () => { if (auth) await signOut(auth); router.push('/'); }} style={{ display:'block', width:'100%', padding:'8px 12px', borderRadius:'var(--radius-md)', color:'var(--ibi-red-light)', fontSize:'0.8rem', textAlign:'left', background:'transparent', border:'none', cursor:'pointer' }}>
                ⏻ Sign Out
              </button>
            </div>
          </aside>

          {/* Main content */}
          <main style={{ flex:1, overflow:'hidden', minWidth:0, display:'flex', flexDirection:'column' }}>
            {/* Mobile tab bar */}
            <div className="hide-desktop" style={{
              position:'sticky', top:HEADER_H, zIndex:50,
              background:'var(--bg-secondary)', borderBottom:'1px solid var(--border-subtle)',
              display:'flex', overflowX:'auto', padding:'0 var(--space-sm)',
            }}>
              {allItems.map(({ href, icon, label }) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                    padding:'8px 12px', whiteSpace:'nowrap', textDecoration:'none', flexShrink:0,
                    borderBottom:`2px solid ${active ? 'var(--ibi-gold)' : 'transparent'}`,
                    color: active ? 'var(--ibi-gold)' : 'var(--text-muted)', fontSize:'0.65rem',
                  }}>
                    <span style={{ fontSize:'0.9rem' }}>{icon}</span>{label}
                  </Link>
                );
              })}
            </div>

            <div style={{ padding:'var(--space-xl)', maxWidth:1100, flex:1 }}>
              <VerifyEmailBanner />
              {children}
            </div>
            <DashboardFooter />
          </main>
        </div>
      </div>

      {showUpgrade && <UpgradeTierModal onClose={() => setShowUpgrade(false)} />}
      {showDonate  && <DonateModal onClose={() => setShowDonate(false)} />}
    </>
  );
}
