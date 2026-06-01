// components/FloatingButtons.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function FloatingButtons() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const fabStyle = (color: string): React.CSSProperties => ({
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: color,
    border: '1px solid var(--border-gold)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-lg)',
    transition: 'all 0.25s var(--ease-out)',
    color: '#fff',
    textDecoration: 'none',
  });

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--space-xl)',
        right: 'var(--space-lg)',
        zIndex: 'var(--z-fab)' as any,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.35s var(--ease-out)',
        pointerEvents: visible ? 'all' : 'none',
      }}
    >
      {/* Back to Home (only when not on homepage) */}
      {!isHome && (
        <Link
          href="/"
          style={fabStyle('var(--bg-elevated)')}
          title="Back to Home"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
        </Link>
      )}

      {/* Back to Top */}
      <button
        onClick={scrollToTop}
        style={fabStyle('var(--ibi-red)')}
        title="Back to top"
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; (e.currentTarget as HTMLElement).style.background = 'var(--ibi-red-dark)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.background = 'var(--ibi-red)'; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="18,15 12,9 6,15"/>
        </svg>
      </button>
    </div>
  );
}
