// app/dashboard/layout.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

const NAV_ITEMS = [
  { href: '/dashboard/overview',  icon: '⬡', label: 'Overview' },
  { href: '/dashboard/idcard',    icon: '🪪', label: 'ID Card' },
  { href: '/dashboard/wallet',    icon: '💰', label: 'Wallet' },
  { href: '/dashboard/affiliate', icon: '🔗', label: 'Affiliate' },
  { href: '/dashboard/cards',     icon: '💳', label: 'IBI Cards' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, member, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=' + pathname);
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, borderColor: 'var(--border-gold)', borderTopColor: 'var(--ibi-gold)', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', paddingTop: 72 }}>
      {/* Sidebar */}
      <aside style={{
        width: 256,
        flexShrink: 0,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 72,
        height: 'calc(100vh - 72px)',
        overflowY: 'auto',
        padding: 'var(--space-lg) var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }} className="hide-mobile">
        {/* Member card */}
        <div style={{
          padding: 'var(--space-md)',
          background: 'var(--grad-card)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--grad-red)',
              border: '2px solid var(--ibi-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: '#fff',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}>
              {member?.displayName?.[0]?.toUpperCase() ?? 'M'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {member?.displayName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--ibi-gold)', fontFamily: 'var(--font-mono)' }}>
                {member?.ibiNumber}
              </div>
            </div>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Wallet</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ibi-gold)', fontFamily: 'var(--font-mono)' }}>
              ₦{(member?.walletBalance ?? 0).toLocaleString()}
            </span>
          </div>
          {/* Status badge */}
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            <span className={`badge ${member?.status === 'active' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
              {member?.status === 'active' ? '● Active' : '● Pending'}
            </span>
            <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>
              {member?.membershipTier}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 8px', marginBottom: 8 }}>
            Menu
          </div>
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 2,
                  background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
                  border: `1px solid ${active ? 'var(--border-gold)' : 'transparent'}`,
                  color: active ? 'var(--ibi-gold)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  fontSize: '0.88rem',
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; } }}
              >
                <span>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Quick links */}
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)' }}>
          <Link href="/membership" style={{ display: 'block', padding: '10px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.82rem', textDecoration: 'none' }}>
            ↑ Upgrade Tier
          </Link>
          <Link href="/contact" style={{ display: 'block', padding: '10px 12px', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.82rem', textDecoration: 'none' }}>
            💬 Support
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {/* Mobile tab bar */}
        <div className="hide-desktop" style={{
          position: 'sticky',
          top: 72,
          zIndex: 50,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          overflowX: 'auto',
          padding: '0 var(--space-md)',
          gap: 4,
        }}>
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '10px 14px',
                borderBottom: `2px solid ${active ? 'var(--ibi-gold)' : 'transparent'}`,
                color: active ? 'var(--ibi-gold)' : 'var(--text-muted)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                fontSize: '0.7rem',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '1rem' }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </div>

        <div style={{ padding: 'var(--space-xl)', maxWidth: 1100 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
