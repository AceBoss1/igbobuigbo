// components/MembershipTiers.tsx
// Full membership tiers for homepage — exact spec
'use client';
import Link from 'next/link';
import { usePricingSettings, type RegistrationFees } from '@/lib/pricing';

const STUDENT_YOUTH_PERKS = [
  'Digital ID Card',
  'IBI Marketplace, Cooperative Programs, Directory Access',
  'Newsletter',
  'IBI NGN Wallet',
  'Affiliate Program',
  'Grants & Scholarships, Escrow Access',
  'Find jobs on Job Board',
  'Voting Rights (vote weight = 1)',
];

const PAID_PERKS = [
  'Everything in Student/Youth',
  'IBI NGN + USD Wallet',
  'Business Listing',
  'FREE Virtual IBI Debit Card',
  'Apply to be voted for',
  '5 Free tokens yearly on Member Verification Portal',
  'Post jobs on Job Board',
  'Voting Rights (vote weight = 5)',
];

const PATRON_PERKS = [
  'Everything in Professional/Business/Diaspora',
  'All Full Member Perks',
  'Priority VIP Support',
  'Lifetime ID Card',
  'Can order limited edition IBI Gold/Black VIP debit cards',
  'Executive VIP Recognition',
  'Annual Summit Access',
  'Voting Rights (vote weight = 10)',
];

// Built from admin-configurable settings/pricing (lib/pricing.ts) — no fee
// is hardcoded here, so changing the Firestore doc updates this section
// (and the membership/upgrade pages, which read the same source) sitewide.
function buildTiers(fees: RegistrationFees) {
  return [
    // Group 1: Free tiers
    {
      group: 'Student / Youth',
      tiers: [
        { id:'student', name:'Student', label:'FREE', note:'Expires when your undergraduate program ends', color:'#4ade80', bg:'rgba(74,222,128,0.06)', border:'rgba(74,222,128,0.25)' },
        { id:'youth',   name:'Youth (18–35yrs)', label:'FREE', note:'Expires when you turn 36 years', color:'#4ade80', bg:'rgba(74,222,128,0.06)', border:'rgba(74,222,128,0.25)' },
      ],
      perks: STUDENT_YOUTH_PERKS,
      cta: { label:'Register Free', href:'/membership?tier=youth' },
    },
    // Group 2: Paid lifetime tiers
    {
      group: 'Professional / Business / Diaspora',
      tiers: [
        { id:'professional', name:'Professional', label:`₦${fees.professional.toLocaleString()}`, note:'One-Time · Lifetime', color:'var(--ibi-gold)', bg:'rgba(212,175,55,0.06)', border:'rgba(212,175,55,0.3)' },
        { id:'business',     name:'Business',     label:`₦${fees.business.toLocaleString()}`,     note:'One-Time · Lifetime', color:'var(--ibi-gold)', bg:'rgba(212,175,55,0.06)', border:'rgba(212,175,55,0.3)' },
        { id:'diaspora',     name:'Diaspora',     label:`$${fees.diasporaUSD}`,                     note:'One-Time · Lifetime', color:'#60a5fa',        bg:'rgba(96,165,250,0.06)',  border:'rgba(96,165,250,0.3)' },
      ],
      perks: PAID_PERKS,
      featured: true,
      cta: { label:'Get Started', href:'/membership?tier=professional' },
    },
    // Group 3: Patron / Executive
    {
      group: 'Patron',
      tiers: [
        { id:'patron', name:'Patron', label:`₦${fees.patron.toLocaleString()}`, note:'One-Time · Lifetime', color:'var(--ibi-red-light)', bg:'rgba(200,16,46,0.06)', border:'rgba(200,16,46,0.3)' },
      ],
      perks: PATRON_PERKS,
      cta: { label:'Become a Patron', href:'/membership?tier=patron' },
    },
  ];
}

function PerkList({ perks, color }: { perks: string[]; color: string }) {
  return (
    <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8 }}>
      {perks.map(p => (
        <li key={p} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:'0.85rem', color:'var(--text-secondary)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ flexShrink:0, marginTop:3 }}>
            <polyline points="20,6 9,17 4,12"/>
          </svg>
          {p}
        </li>
      ))}
    </ul>
  );
}

export default function MembershipTiers() {
  const { pricing } = usePricingSettings();
  const TIERS = buildTiers(pricing.registrationFees);

  return (
    <section className="section" style={{ background:'var(--bg-primary)' }}>
      <div className="container">
        <div style={{ textAlign:'center', marginBottom:'var(--space-2xl)' }}>
          <div className="section-label">Membership</div>
          <h2 className="section-title">Registration Fees by Category</h2>
          <p className="section-desc" style={{ margin:'0 auto' }}>
            One-Time Registration &nbsp;·&nbsp; Lifetime Membership
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'var(--space-lg)', alignItems:'start' }}>
          {TIERS.map(({ group, tiers, perks, featured, cta }) => {
            const primaryColor = tiers[0].color;
            const primaryBorder = tiers[0].border;
            return (
              <div key={group} style={{
                background:'var(--grad-card)',
                border:`1px solid ${primaryBorder}`,
                borderRadius:'var(--radius-xl)',
                padding:'var(--space-xl)',
                position:'relative',
                transform: featured ? 'scale(1.02)' : 'none',
                boxShadow: featured ? '0 0 40px rgba(212,175,55,0.1)' : 'none',
              }}>
                {featured && (
                  <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:'var(--grad-gold)', color:'#1a0f00', padding:'4px 20px', borderRadius:'var(--radius-full)', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                    Most Popular
                  </div>
                )}

                {/* Group label */}
                <div style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:primaryColor, marginBottom:12 }}>
                  {group}
                </div>

                {/* Tier price tags */}
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:'var(--space-lg)' }}>
                  {tiers.map(t => (
                    <div key={t.id} style={{ background:t.bg, border:`1px solid ${t.border}`, borderRadius:'var(--radius-md)', padding:'8px 14px' }}>
                      <div style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:2 }}>{t.name}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.25rem', fontWeight:900, color:t.color, lineHeight:1 }}>{t.label}</div>
                      <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:3 }}>{t.note}</div>
                    </div>
                  ))}
                </div>

                <div className="divider" style={{ margin:'var(--space-md) 0' }} />

                <PerkList perks={perks} color={primaryColor} />

                <div style={{ marginTop:'var(--space-lg)' }}>
                  <Link
                    href={cta.href}
                    className={featured ? 'btn btn-gold' : 'btn btn-outline'}
                    style={{ width:'100%', justifyContent:'center' }}
                  >
                    {cta.label}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* BoT note */}
        <div style={{ marginTop:'var(--space-xl)', padding:'12px 20px', background:'rgba(212,175,55,0.04)', border:'1px dashed var(--border-gold)', borderRadius:'var(--radius-md)', fontSize:'0.82rem', color:'var(--text-muted)', textAlign:'center', lineHeight:1.7 }}>
          ℹ️ Chapter Executive, Honorary &amp; Board of Trustees (BoT) membership is by appointment — no registration fee. Annual levies and chapter dues may apply separately.
        </div>
      </div>
    </section>
  );
}
