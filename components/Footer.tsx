// components/Footer.tsx
import Link from 'next/link';

const FOOTER_LINKS = {
  Organization: [
    { label: 'About IBI',     href: '/#about' },
    { label: 'Leadership',    href: '/#leadership' },
    { label: 'Chapters',      href: '/#chapters' },
    { label: 'Constitution',  href: '/constitution' },
    { label: 'Annual Report', href: '/annual-report' },
  ],
  Membership: [
    { label: 'Join IBI',        href: '/membership' },
    { label: 'Member Login',    href: '/login' },
    { label: 'Dashboard',       href: '/dashboard/overview' },
    { label: 'Digital ID Card', href: '/dashboard/idcard' },
    { label: 'IBI Cards',       href: '/dashboard/cards' },
  ],
  Services: [
    { label: 'Affiliate Program', href: '/dashboard/affiliate' },
    { label: 'IBI Wallet',        href: '/dashboard/wallet' },
    { label: 'Donate',            href: '/donate' },
    { label: 'Business Directory',href: '/coming-soon/directory' },
    { label: 'Escrow Service',    href: '/coming-soon/escrow' },
  ],
  Support: [
    { label: 'Contact Us',    href: '/contact' },
    { label: 'FAQ',           href: '/faq' },
    { label: 'Privacy Policy',href: '/privacy' },
    { label: 'Terms of Use',  href: '/terms' },
    { label: 'Whistleblower', href: '/coming-soon/whistleblower' },
  ],
};

const CHAPTERS = [
  'Lagos', 'Enugu', 'Anambra', 'Imo', 'Abia',
  'Ebonyi', 'Rivers', 'FCT', 'Delta', 'Cross River',
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-subtle)',
      paddingTop: 'var(--space-3xl)',
    }}>
      {/* Top banner */}
      <div style={{
        background: 'linear-gradient(90deg, var(--ibi-red-dark), var(--ibi-red), var(--ibi-red-dark))',
        padding: '20px var(--space-lg)',
        textAlign: 'center',
        marginBottom: 'var(--space-3xl)',
      }}>
        <p style={{
          color: '#fff',
          fontSize: '0.9rem',
          margin: 0,
          fontWeight: 500,
        }}>
          🦅 <strong>Igbobuigbo</strong> — Uniting Igbo Business Minds Across Nigeria &amp; the Diaspora.{' '}
          <Link href="/membership" style={{ color: 'var(--ibi-gold)', textDecoration: 'underline' }}>
            Become a Member Today →
          </Link>
        </p>
      </div>

      <div className="container">
        {/* Main footer grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-xl)',
          marginBottom: 'var(--space-3xl)',
        }}>
          {/* Brand column */}
          <div style={{ gridColumn: 'span 1' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--space-md)' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--grad-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--ibi-gold)',
              }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 16, fontFamily: 'var(--font-display)' }}>IBI</span>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                  Igbobuigbo
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--ibi-gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Est. 2020
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
              Igbo Business Union International (IBI) — a pan-Igbo economic solidarity network driving prosperity for Igbo entrepreneurs worldwide.
            </p>
            {/* Socials */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Facebook',  href: 'https://facebook.com/igbobuigbo',  icon: 'f' },
                { label: 'Twitter/X', href: 'https://twitter.com/igbobuigbo',   icon: 'x' },
                { label: 'Instagram', href: 'https://instagram.com/igbobuigbo', icon: 'ig' },
                { label: 'WhatsApp',  href: 'https://wa.me/234',                icon: 'wa' },
              ].map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'var(--ibi-gold)';
                    el.style.color = 'var(--ibi-gold)';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = 'var(--border-subtle)';
                    el.style.color = 'var(--text-muted)';
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h5 style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ibi-gold)',
                marginBottom: 'var(--space-md)',
                fontFamily: 'var(--font-body)',
              }}>
                {category}
              </h5>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} style={{
                      fontSize: '0.87rem',
                      color: 'var(--text-muted)',
                      textDecoration: 'none',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Chapters strip */}
        <div style={{
          padding: 'var(--space-lg)',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 'var(--space-xl)',
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ibi-gold)', marginBottom: 10 }}>
            Active Chapters
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CHAPTERS.map(ch => (
              <span key={ch} style={{
                padding: '4px 12px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}>
                {ch}
              </span>
            ))}
            <span style={{
              padding: '4px 12px',
              background: 'rgba(212,175,55,0.08)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              color: 'var(--ibi-gold)',
              border: '1px solid var(--border-gold)',
            }}>
              + Diaspora Chapters
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-md)',
          padding: 'var(--space-lg) 0',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            © {year} Igbobuigbo.org.ng — Igbo Business Union International. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
            {['Privacy Policy', 'Terms of Use', 'Cookie Policy'].map(item => (
              <Link
                key={item}
                href={`/${item.toLowerCase().replace(/ /g, '-')}`}
                style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
