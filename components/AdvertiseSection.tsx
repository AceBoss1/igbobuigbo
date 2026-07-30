// components/AdvertiseSection.tsx
// "Advertise With Us" homepage section
import Link from 'next/link';

const AD_PLANS = [
  {
    id: 'starter',
    emoji: '🏆',
    name: 'Starter',
    badge: 'Most Popular',
    badgeColor: '#4ade80',
    price: '₦5,000',
    period: '12 Months',
    color: '#4ade80',
    border: 'rgba(74,222,128,0.3)',
    bg: 'rgba(74,222,128,0.05)',
perks: [
  'Business Directory Listing',
  '12-Month Visibility',
  'Inner Pages Ad Rotation',
  '2,000 Banner Impressions',
  'Basic Performance Statistics',
  '❌ Full Analytics Dashboard',
  '❌ Priority Placement Across Platform',
],
  },

  {
    id: 'standard',
    emoji: '⭐️',
    name: 'Standard',
    badge: 'Recommended',
    badgeColor: 'var(--ibi-gold)',
    price: '₦15,000',
    period: '12 Months',
    color: 'var(--ibi-gold)',
    border: 'var(--border-gold)',
    bg: 'rgba(212,175,55,0.06)',
    featured: true,
perks: [
  'Featured Business Listing',
  '12-Month Visibility',
  'Priority Inner Pages Rotation',
  '10,000 Banner Impressions',
  'Enhanced Performance Statistics',
  '❌ Full Analytics Dashboard',
  '❌ Priority Placement Across Platform',
],
  },

  {
    id: 'premium',
    emoji: '👑',
    name: 'Premium Partner',
    badge: 'Most Profitable',
    badgeColor: 'var(--ibi-red-light)',
    price: '₦35,000',
    period: '12 Months',
    color: 'var(--ibi-red-light)',
    border: 'var(--border-red)',
    bg: 'rgba(200,16,46,0.05)',
    perks: [
      'Premium Partner Status',
      '12-Month Visibility',
      'Homepage Banner Rotation',
      '50,000 Banner Impressions',
      'WhatsApp Community Promotion',
      'Full Analytics Dashboard',
      'Priority Placement Across Platform',
    ],
  },
];



export default function AdvertiseSection() {
  return (
    <section id="advertise" className="section" style={{ background: 'var(--bg-secondary)' }}>
      <div className="container">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <div className="section-label">Reach Your Audience</div>
          <h2 className="section-title">Reach Millions of Ndi Igbo</h2>
          <p className="section-desc" style={{ margin: '0 auto var(--space-lg)', maxWidth: 580 }}>
            Place your ad in front of millions of Ndi Igbo via our magazine, TV, web and mobile.
          </p>
          <Link href="/coming-soon/advertise" className="btn btn-primary btn-lg" style={{ gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Start Advertising
          </Link>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-lg)', alignItems: 'start' }}>
          {AD_PLANS.map(({ id, emoji, name, badge, badgeColor, price, period, color, border, bg, featured, perks }) => (
            <div key={id} style={{
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-xl)',
              position: 'relative',
              transform: featured ? 'scale(1.04)' : 'none',
              boxShadow: featured ? '0 0 40px rgba(212,175,55,0.1)' : 'none',
            }}>
{badge && (
  <div
    style={{
      position: 'absolute',
      top: -13,
      left: '50%',
      transform: 'translateX(-50%)',
      background: badgeColor,
      color: '#fff',
      padding: '4px 18px',
      borderRadius: '999px',
      fontSize: '0.68rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      boxShadow: `0 0 20px ${badgeColor}`,
    }}
  >
    {badge}
  </div>
)}

              {/* Emoji + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-md)' }}>
                <span style={{ fontSize: '1.6rem' }}>{emoji}</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>{name}</div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{price}</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 6 }}>{period}</span>
              </div>

              {/* Perks */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {perks.map(p => (
<li
  key={p}
  style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: '0.87rem',
    color: p.startsWith('❌')
      ? 'var(--text-muted)'
      : 'var(--text-secondary)',
    opacity: p.startsWith('❌') ? 0.7 : 1,
  }}
>
  {p.startsWith('❌') ? (
    <span
      style={{
        color: '#ef4444',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      ✕
    </span>
  ) : (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      style={{ flexShrink: 0, marginTop: 3 }}
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  )}

  {p.replace('❌ ', '')}
</li>
                ))}
              </ul>

              <Link
                href="/coming-soon/advertise"
                className={featured ? 'btn btn-gold' : 'btn btn-outline'}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Choose {name}
              </Link>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 'var(--space-xl)',
          padding: '12px 20px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: 1.7,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <span>✅ All ads reviewed and approved by admin within 48 hours</span>
          <span style={{ color: 'var(--border-subtle)' }}>·</span>
          <span>✅ No account needed to advertise</span>
          <span style={{ color: 'var(--border-subtle)' }}>·</span>
          <span>✅ Pay via IBI Wallet or Paystack</span>
        </div>

<div
  style={{
    marginTop: '16px',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    lineHeight: 1.6,
  }}
>
  Banner impressions are served through a rotating advertising system.
  Placement frequency depends on campaign tier, available inventory,
  and the number of active advertisers.
</div>

      </div>
    </section>
  );
}
