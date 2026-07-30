// components/Navbar.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import LogoCircle from './LogoCircle';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

const NAV_LINKS = [
  { label: 'Home',       href: '/' },
  { label: 'About',      href: '/#about' },
  { label: 'Chapters',   href: '/chapters' },
  { label: 'Membership', href: '/membership' },
  { label: 'Donate',     href: '/donate' },
  { label: 'News',       href: '/#news' },
  { label: 'Contact',    href: '/contact' },
];

export default function Navbar() {
  const [open,     setOpen]     = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const { user, member, loading } = useAuth();
  const pathname = usePathname();
  const dropRef  = useRef<HTMLDivElement>(null);

  /* Scroll shadow */
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Lock scroll when mobile menu is open */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

const handleSignOut = async () => {
  if (!auth) return;
  await signOut(auth);
  setDropOpen(false);
  window.location.href = "/";
};

  return (
    <>
      <nav
        style={{
          position:   'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex:     'var(--z-nav)' as any,
          background: scrolled
            ? 'rgba(10, 12, 16, 0.95)'
            : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: '0 var(--space-lg)',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <LogoCircle size={40} />
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '1.05rem',
                color: 'var(--text-primary)',
                lineHeight: 1.15,
              }}>
                Igbo Bu Igbo
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--ibi-gold)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Unity &amp; Cultural Preservation Initiative
              </div>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <ul style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }} className="hide-mobile">
            {NAV_LINKS.map(({ label, href }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link href={href} style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.88rem',
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--ibi-gold)' : 'var(--text-secondary)',
                    background: active ? 'rgba(212,175,55,0.08)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    display: 'block',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.target as HTMLElement).style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.target as HTMLElement).style.color = 'var(--text-secondary)';
                  }}>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right: Auth + CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="hide-mobile">
            {loading ? (
              <div className="spinner" style={{ borderColor: 'var(--border-gold)', borderTopColor: 'var(--ibi-gold)' }} />
            ) : user ? (
              /* Logged-in user dropdown — shows as soon as user exists, member data fills in async */
              <div ref={dropRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropOpen(!dropOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 16px 6px 6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: 'var(--radius-full)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: member?.photoURL ? `url(${member.photoURL}) center/cover` : 'var(--grad-red)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 700, color: '#fff', overflow: 'hidden',
                  }}>
                    {!member?.photoURL && (member?.displayName?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? 'M')}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.2 }}>
                      {member?.displayName?.split(' ')[0] ?? user.displayName?.split(' ')[0] ?? 'Member'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--ibi-gold)', fontFamily: 'var(--font-mono)' }}>
                      {member?.ibiNumber ?? (member ? 'Pending' : '…')}
                    </div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-muted)', transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>

                {dropOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    minWidth: 220, background: 'var(--bg-card)',
                    border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
                    animation: 'fadeInUp 0.2s var(--ease-out)', zIndex: 200,
                  }}>
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Wallet Balance</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ibi-gold)', fontFamily: 'var(--font-mono)' }}>
                        ₦{(member?.walletBalance ?? 0).toLocaleString()}
                      </div>
                    </div>
                    {[
                      { label: 'Overview',    href: '/dashboard/overview' },
                      { label: 'My Profile',  href: '/dashboard/profile' },
                      { label: 'My ID Card',  href: '/dashboard/idcard' },
                      { label: 'Wallet',      href: '/dashboard/wallet' },
                      { label: 'Affiliate',   href: '/dashboard/affiliate' },
                      { label: 'IBI Cards',   href: '/dashboard/cards' },
                    ].map(({ label, href }) => (
                      <Link key={href} href={href} onClick={() => setDropOpen(false)} style={{
                        display: 'block', padding: '10px 16px',
                        fontSize: '0.88rem', color: 'var(--text-secondary)',
                        textDecoration: 'none', transition: 'all 0.15s',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                        {label}
                      </Link>
                    ))}
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: '100%', padding: '10px 16px',
                        background: 'transparent', border: 'none',
                        color: 'var(--ibi-red-light)', fontSize: '0.88rem',
                        textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,16,46,0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
                <Link href="/membership" className="btn btn-primary btn-sm">Join IBI</Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            className="hide-desktop"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            <span style={{
              display: 'block',
              width: 22,
              height: 2,
              background: 'currentColor',
              borderRadius: 2,
              transition: 'all 0.3s',
              transform: open ? 'translateY(7px) rotate(45deg)' : 'none',
            }} />
            <span style={{
              display: 'block',
              width: 22,
              height: 2,
              background: 'currentColor',
              borderRadius: 2,
              transition: 'all 0.3s',
              opacity: open ? 0 : 1,
            }} />
            <span style={{
              display: 'block',
              width: 22,
              height: 2,
              background: 'currentColor',
              borderRadius: 2,
              transition: 'all 0.3s',
              transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none',
            }} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        className="hide-desktop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 'calc(var(--z-nav) - 1)' as any,
          pointerEvents: open ? 'all' : 'none',
        }}
      >
        {/* Backdrop */}
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            opacity: open ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />
        {/* Drawer panel */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(320px, 90vw)',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-gold)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: '88px var(--space-lg) var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflowY: 'auto',
        }}>
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontWeight: 500,
                color: pathname === href ? 'var(--ibi-gold)' : 'var(--text-secondary)',
                background: pathname === href ? 'rgba(212,175,55,0.08)' : 'transparent',
                textDecoration: 'none',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              {label}
            </Link>
          ))}
          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {user ? (
              <>
                <Link href="/dashboard/overview" className="btn btn-outline" onClick={() => setOpen(false)}>Dashboard</Link>
                <button className="btn btn-ghost" onClick={handleSignOut}>Sign Out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-outline" onClick={() => setOpen(false)}>Sign In</Link>
                <Link href="/membership" className="btn btn-primary" onClick={() => setOpen(false)}>Join IBI</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
