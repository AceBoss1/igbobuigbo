// components/Footer.tsx
// Server Component — no event handlers, CSS-only hover.
import Link from 'next/link';

const FOOTER_LINKS = {
  Organization: [
    { label: 'About IBI',          href: '/#about' },
    { label: 'Advertise With Us', href: '/#advertise' },
    { label: 'Chapters/Regions',           href: '/chapters' },
    { label: 'Constitution',       href: '/constitution' },
    { label: 'Annual Report',      href: '/annual-report' },
    { label: 'Verify',             href: '/verify' },
  ],
  Membership: [
    { label: 'Join IBI',           href: '/membership' },
    { label: 'Member Login',       href: '/login' },
    { label: 'Dashboard',          href: '/dashboard/overview' },
    { label: 'Digital ID Card',    href: '/dashboard/idcard' },
    { label: 'IBI Cards',          href: '/dashboard/cards' },
    { label: 'IBI Wallet',         href: '/dashboard/wallet' },
  ],
  Programs: [
    { label: 'Food Sharing Groups',href: '/coming-soon/cooperative' },
    { label: 'Bulk Purchasing',    href: '/coming-soon/cooperative' },
    { label: 'Ajo / Isusu Circles',href: '/coming-soon/cooperative' },
    { label: '3-Gate Escrow',      href: '/coming-soon/escrow' },
    { label: 'Business Marketplace',href: '/coming-soon/marketplace' },
    { label: 'Affiliate',          href: '/dashboard/affiliate' },
  ],
  Support: [
    { label: 'Contact Us',         href: '/contact' },
    { label: 'FAQ',                href: '/faq' },
    { label: 'Privacy Policy',     href: '/privacy' },
    { label: 'Terms of Use',       href: '/terms' },
    { label: 'Whistleblower',      href: '/coming-soon/whistleblower' },
    { label: 'Support Staff Login',href: '/admin' },
  ],
};

const CHAPTERS = [
  'Lagos','Enugu','Anambra','Imo','Abia','Ebonyi',
  'Rivers','FCT','Delta','Cross River','Onitsha','Port Harcourt',
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3xl)' }}>

      {/* ── Top banner ─────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(90deg, var(--ibi-red-dark), var(--ibi-red), var(--ibi-red-dark))', padding: '20px var(--space-lg)', textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
        <p style={{ color: '#fff', fontSize: '0.9rem', margin: 0, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <picture>
            <source srcSet="/logo.png" type="image/png" />
            <img src="/logo.svg" alt="IBI" width={28} height={28} style={{ borderRadius: '50%', border: '1.5px solid #D4AF37', verticalAlign: 'middle', display: 'inline-block', flexShrink: 0 }} />
          </picture>
          <span><strong>Igbo Bu Igbo</strong> — Uniting Igbo People Across Nigeria &amp; the Diaspora.{' '}
          <Link href="/membership" style={{ color: 'var(--ibi-gold)', textDecoration: 'underline' }}>
            Become a Member Today →
          </Link></span>
        </p>
      </div>

      <div className="container">

        {/* ── Main grid ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-xl)', marginBottom: 'var(--space-3xl)' }}>

          {/* Brand column */}
          <div>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 'var(--space-md)' }}>
              {/*
                <picture> tries logo.png first, falls back to logo.svg.
                logo.svg is always present in /public — so the logo always shows.
                No JS event handler needed.
              */}
              <picture>
                <source srcSet="/logo.png" type="image/png" />
                <img
                  src="/logo.svg"
                  alt="Igbo Bu Igbo"
                  width={44}
                  height={44}
                  style={{ borderRadius:'50%', border:'2px solid var(--ibi-gold)', objectFit:'cover', display:'block' }}
                />
              </picture>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>Igbo Bu Igbo</div>
                <div style={{ fontSize: '0.58rem', color: 'var(--ibi-gold)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Unity &amp; Cultural Preservation Initiative</div>
              </div>
            </Link>

            <p style={{ fontSize: '0.82rem', lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
              A registered cultural and unity initiative dedicated to uniting Igbo people through cultural preservation, community development, and collective empowerment.
            </p>

            {/* Contact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--space-md)' }}>
              {[
                { icon: '📍', text: 'National Secretariat, Enugu, Nigeria' },
                { icon: '✉️', text: 'info@igbobuigbo.org.ng', href: 'mailto:info@igbobuigbo.org.ng' },
                { icon: '📞', text: '+234 (0) 806 787 1203',  href: 'tel:+2348067871203' },
              ].map(({ icon, text, href }) => (
                <div key={text} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.75rem', marginTop: 2 }}>{icon}</span>
                  {href ? (
                    <a href={href} className="hover-text-primary" style={{ fontSize: '0.78rem', textDecoration: 'none' }}>{text}</a>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{text}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Socials */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="https://web.facebook.com/profile.php?id=100069371552458" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="hover-gold-border"
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, textDecoration: 'none' }}>
                Fb
              </a>
              <a href="https://chat.whatsapp.com/DxruPES8fJP4V4zwMd6kPc" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp Community" className="hover-gold-border"
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, textDecoration: 'none' }}>
                Wa
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h5 style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ibi-gold)', marginBottom: 'var(--space-md)', fontFamily: 'var(--font-body)' }}>
                {category}
              </h5>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="hover-text-primary" style={{ fontSize: '0.85rem', textDecoration: 'none' }}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Chapters strip ────────────────────────────────────── */}
        <div style={{ padding: 'var(--space-lg)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-xl)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ibi-gold)', marginBottom: 10 }}>
            Active Chapters — 43 Across Nigeria &amp; Diaspora
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CHAPTERS.map(ch => (
              <span key={ch} style={{ padding: '4px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {ch}
              </span>
            ))}
            <span style={{ padding: '4px 12px', background: 'rgba(212,175,55,0.08)', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', color: 'var(--ibi-gold)', border: '1px solid var(--border-gold)' }}>
              <a href= '/chapters'> + 31 More Chapters </a>
            </span>
          </div>
        </div>

        {/* ── Bottom bar ────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)', padding: 'var(--space-lg) 0', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              © {year} Igbo Bu Igbo Unity and Cultural Preservation Initiative. All rights reserved.
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
              Developed by{' '}
              <a href="https://www.adams.com.ng/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ibi-gold)', textDecoration: 'none' }}>
                Adams Consults
              </a>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Use',   href: '/terms' },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="hover-text-primary" style={{ fontSize: '0.76rem', textDecoration: 'none' }}>
                {label}
              </Link>
            ))}
            <span style={{ fontSize: '0.76rem', color: 'var(--ibi-gold)', fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.04em' }}>
              igbobuigbo.org.ng
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}