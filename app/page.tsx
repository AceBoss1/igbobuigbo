// app/page.tsx
// Server Component — uses Firebase Admin SDK for SSR data fetching.
import Link from 'next/link';
import { adminDb } from '@/lib/firebase-admin';
import type { Metadata } from 'next';
import HomeBanner from '@/components/HomeBanner';
import MembershipTiers from '@/components/MembershipTiers';
import HeroCardShowcase from '@/components/HeroCardShowcase';
import CardImageWithFallback from '@/components/CardImageWithFallback';
import AdvertiseSection    from '@/components/AdvertiseSection';
import HeroLogoRings      from '@/components/HeroLogoRings';
import CTASectionAnimated from '@/components/CTASectionAnimated';

export const metadata: Metadata = {
  title: 'Igbo Bu Igbo — Unity & Cultural Preservation Initiative',
  description: 'Igbo Bu Igbo is a registered cultural and unity initiative dedicated to uniting Igbo people through cultural preservation, community development, and collective empowerment.',
};

async function getEvents() {
  try {
    const snap = await adminDb.collection('events').where('active','==',true).orderBy('date','desc').limit(3).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  } catch { return []; }
}
async function getNews() {
  try {
    const snap = await adminDb.collection('news').where('published','==',true).orderBy('createdAt','desc').limit(6).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  } catch { return []; }
}

// Returns "2026 2nd Quarter", "2026 3rd Quarter", etc. — always current
function getCurrentQuarterLabel(): string {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3) + 1;
  const ordinals = ['1st','2nd','3rd','4th'];
  return `${year} ${ordinals[quarter - 1]} Quarter`;
}

// ── Updated cooperative programs ──────────────────────────────────────────────
const COOP_PROGRAMS = [
  { icon:'🍱', title:'Food Sharing Groups',        desc:'Community food pools ensuring no member goes without — organised by chapter zones.' },
  { icon:'🚢', title:'Bulk Purchasing',            desc:'Group imports from China and local markets. Buy more, pay less — together.' },
  { icon:'✈️', title:'Community Travel Groups',   desc:'Coordinated group travel for trade missions, cultural tours, and diaspora visits.' },
  { icon:'💰', title:'Ajo / Isusu Circles',        desc:'Traditional rotating savings — digitized. Trustworthy, transparent, on-chain.' },
  { icon:'💳', title:'IBI Membership Cards',       desc:'Co-branded debit card — your identity, chapter, membership number wherever you go.' },
  { icon:'🤲', title:'Onye Aghana Nwanne Ya',      desc:'Grants, scholarships, support during bereavement, emergencies, medical appeals.' },
  { icon:'💼', title:'Job Board & Career Network', desc:'Find/post jobs, access internship placements and opportunities across all chapters.' },
  { icon:'⚖️', title:'Legal Protection & Advocacy',desc:'Dispute resolution support and representation designed to protect rights and interests.' },
];

const MARKETPLACE_CATS = [
  {icon:'👗',label:'Fashion'},{icon:'🥘',label:'Food'},{icon:'📱',label:'Electronics'},
  {icon:'🌾',label:'Agriculture'},{icon:'⚙️',label:'Services'},{icon:'🎨',label:'Artisans'},
];

export default async function HomePage() {
  const [events, news] = await Promise.all([getEvents(), getNews()]);
  const quarterLabel   = getCurrentQuarterLabel();

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        background: 'linear-gradient(135deg, #1a0005 0%, #2d0008 40%, #1a0005 100%)',
        position: 'relative', overflow: 'hidden', paddingTop: 100,
      }}>
        <div style={{ position:'absolute', top:'10%', right:'-5%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(200,16,46,0.1) 0%, transparent 65%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'-10%', left:'-5%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 65%)', pointerEvents:'none' }} />

        <div className="container">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'var(--space-2xl)', alignItems:'center' }}>

            {/* Left: Text */}
            <div>
              {/* Dynamic registration badge */}
              <div className="badge badge-gold animate-fade-in-up" style={{ marginBottom: 24, fontSize:'0.78rem' }}>
                🦅 {quarterLabel} Membership Registration Is Open
              </div>

              <h1 className="animate-fade-in-up delay-100" style={{ marginBottom: 20, fontSize:'clamp(2.4rem,6vw,4.5rem)', lineHeight:1.08 }}>
                <span style={{ color:'#fff' }}>Onye Aghana </span>
                <span style={{ color:'var(--ibi-gold)' }}>Nwanne Ya</span>
              </h1>

              <p className="animate-fade-in-up delay-200" style={{ fontSize:'1.05rem', lineHeight:1.85, marginBottom:16, color:'rgba(255,255,255,0.78)' }}>
                No Igbo person left behind. We unite Igbo people everywhere through cultural preservation, cooperative economics, and collective empowerment.
              </p>

              <p className="animate-fade-in-up delay-200" style={{ fontSize:'0.88rem', color:'rgba(255,255,255,0.45)', marginBottom:36, fontStyle:'italic' }}>
                Call or WhatsApp:{' '}
                <a href="tel:+2348067871203" style={{ color:'var(--ibi-gold)', textDecoration:'none' }}>+234 (0) 806 787 1203</a>
              </p>

              <div className="animate-fade-in-up delay-300" style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                <Link href="/membership" className="btn btn-primary btn-lg">
                  Join IBI Today
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <a
                  href="https://chat.whatsapp.com/DxruPES8fJP4V4zwMd6kPc"
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-outline btn-lg"
                  style={{ borderColor:'rgba(37,211,102,0.5)', color:'#25D366' }}
                >
                  💬 WhatsApp Community
                </a>
              </div>
            </div>

            {/* Right: Logo + Demo cards */}
            <div className="animate-fade-in-up delay-300" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'var(--space-lg)' }}>
              <HeroLogoRings />
              <HeroCardShowcase />
              <Link href="/dashboard/cards" className="btn btn-gold btn-sm" style={{ gap:8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Order Your IBI Card
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── STATS BAR + FEATURE STRIP + WHO WE ARE + VIDEO ──── */}
      <HomeBanner />

      {/* ── COOPERATIVE PROGRAMS ──────────────────────────────── */}
      <section className="section" style={{ background:'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:'var(--space-2xl)' }}>
            <div className="section-label">Community First</div>
            <h2 className="section-title">Cooperative Community Programs</h2>
            <p className="section-desc" style={{ margin:'0 auto', maxWidth:640 }}>
              <em style={{ color:'var(--ibi-gold)', fontStyle:'normal', fontWeight:600 }}>Onye Aghana Nwanne Ya</em> — No Igbo person is left behind. Our cooperative programs ensure every member thrives together.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'var(--space-lg)' }}>
            {COOP_PROGRAMS.map(({ icon, title, desc }) => (
              <div key={title} className="card hover-card">
                <div style={{ fontSize:'2rem', marginBottom:14 }}>{icon}</div>
                <h4 style={{ marginBottom:8, fontSize:'0.95rem' }}>{title}</h4>
                <p style={{ fontSize:'0.83rem', margin:0, lineHeight:1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center', marginTop:'var(--space-xl)' }}>
            <Link href="/coming-soon/cooperative" className="btn btn-outline">Explore All Programs →</Link>
          </div>
        </div>
      </section>

      {/* ── MARKETPLACE ──────────────────────────────────────── */}
      <section className="section" style={{ background:'var(--bg-primary)' }}>
        <div className="container">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'var(--space-2xl)', alignItems:'center' }}>
            <div>
              <div className="section-label">Igbo Business Marketplace</div>
              <h2 className="section-title">Buy Igbo. Support Igbo.</h2>
              <p style={{ color:'var(--text-secondary)', fontSize:'1rem', lineHeight:1.8, marginBottom:24 }}>
                Browse and buy from verified Igbo-owned businesses across all 43 chapters. Fashion, food, electronics, agriculture, services, and artisans — all trusted, all verified.
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:32 }}>
                {MARKETPLACE_CATS.map(({ icon, label }) => (
                  <span key={label} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-full)', fontSize:'0.82rem', color:'var(--text-secondary)' }}>
                    {icon} {label}
                  </span>
                ))}
              </div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                <Link href="/coming-soon/marketplace" className="btn btn-gold">Browse Marketplace</Link>
                <Link href="/dashboard/affiliate" className="btn btn-outline">Become an Affiliate — 5% per sale</Link>
              </div>
            </div>
            <div style={{ background:'var(--grad-card)', border:'1px solid var(--border-gold)', borderRadius:'var(--radius-xl)', padding:'var(--space-xl)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)' }} />
              <div style={{ fontSize:'0.72rem', color:'var(--ibi-gold)', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>Affiliate Program</div>
              {[
                ['Commission on membership referral','10% (NGN or USD→NGN)'],
                ['Commission on marketplace sales',  '5% per sale'],
                ['Active sellers',                   '2,400+'],
                ['Products listed',                  '18,000+'],
                ['Chapters covered',                 '43/43'],
                ['Payout method',                    'IBI Wallet (instant)'],
              ].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize:'0.83rem', color:'var(--text-secondary)' }}>{l}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--ibi-gold)', fontSize:'0.85rem' }}>{v}</span>
                </div>
              ))}
              <Link href="/coming-soon/marketplace" className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:20 }}>
                List Your Business →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── IBI CARDS PREVIEW ────────────────────────────────── */}
      <section className="section" style={{ background:'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign:'center', marginBottom:'var(--space-2xl)' }}>
            <div className="section-label">IBI Membership Cards</div>
            <h2 className="section-title">Your Membership Card. Accepted Everywhere.</h2>
            <p className="section-desc" style={{ margin:'0 auto', maxWidth:680 }}>
              Every IBI member gets a co-branded Verve, AfriGo, Visa or Mastercard — carrying your identity, chapter, and membership number wherever you go.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'var(--space-lg)', marginBottom:'var(--space-xl)' }}>
            {[
              { src:'/demo_verve.webp',      name:'IBI Verve Card',  type:'Naira · Nigeria',   avail:'Virtual + Physical', color:'#00b16a' },
              { src:'/demo_afrigo.webp',     name:'IBI AfriGo Card', type:'Naira · Pan-Africa', avail:'Virtual + Physical', color:'#e67e22' },
              { src:'/demo_visa.webp',       name:'IBI Visa Card',   type:'USD · Worldwide',   avail:'Virtual only',       color:'#4a7fff' },
              { src:'/demo_mastercard.webp', name:'IBI Mastercard',  type:'USD · Worldwide',   avail:'Virtual only',       color:'#eb001b' },
            ].map(({ src, name, type, avail, color }) => (
              <div key={name} className="card hover-card" style={{ textAlign:'center', padding:'var(--space-md)' }}>
                <CardImageWithFallback src={src} alt={name} fallbackLabel={name} fallbackColor={color} />
                <div style={{ fontWeight:700, fontSize:'0.9rem', color:'var(--text-primary)', marginBottom:4, marginTop:12 }}>{name}</div>
                <div style={{ fontSize:'0.75rem', color, fontWeight:600, marginBottom:4 }}>{type}</div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{avail}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center' }}>
            <Link href="/dashboard/cards" className="btn btn-gold btn-lg">Order Your IBI Card →</Link>
          </div>
        </div>
      </section>

      {/* ── MEMBERSHIP TIERS ──────────────────────────────────── */}
      <MembershipTiers />

      {/* ── ADVERTISE WITH US ─────────────────────────────────── */}
      <AdvertiseSection />

      {/* ── EVENTS ───────────────────────────────────────────── */}
      {events.length > 0 && (
        <section className="section" style={{ background:'var(--bg-primary)' }}>
          <div className="container">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'var(--space-xl)' }}>
              <div><div className="section-label">Events</div><h2 className="section-title" style={{ marginBottom:0 }}>Upcoming Gatherings</h2></div>
              <Link href="/events" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'var(--space-lg)' }}>
              {events.map((ev: any) => (
                <div key={ev.id} className="card">
                  <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:'var(--space-md)' }}>
                    <div style={{ width:52, height:52, background:'rgba(200,16,46,0.1)', border:'1px solid var(--border-red)', borderRadius:'var(--radius-md)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <div style={{ fontSize:'1.1rem', fontWeight:900, color:'var(--ibi-red-light)', lineHeight:1 }}>{new Date(ev.date?.seconds*1000).getDate()}</div>
                      <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{new Date(ev.date?.seconds*1000).toLocaleString('en',{month:'short'})}</div>
                    </div>
                    <div>
                      <h4 style={{ marginBottom:4, fontSize:'0.95rem' }}>{ev.title}</h4>
                      <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>📍 {ev.location}</div>
                    </div>
                  </div>
                  <p style={{ fontSize:'0.83rem', margin:0 }}>{ev.excerpt}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── NEWS ─────────────────────────────────────────────── */}
      <section id="news" className="section" style={{ background:'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'var(--space-xl)' }}>
            <div><div className="section-label">News</div><h2 className="section-title" style={{ marginBottom:0 }}>Latest from IBI</h2></div>
            {news.length > 0 && <Link href="/news" className="btn btn-ghost btn-sm">View All</Link>}
          </div>
          {news.length > 0 ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'var(--space-lg)' }}>
              {news.map((post: any) => (
                <Link key={post.id} href={`/news/${post.slug}`} className="card hover-card" style={{ display:'block', textDecoration:'none' }}>
                  {post.imageUrl && (
                    <div style={{ height:160, borderRadius:'var(--radius-md)', overflow:'hidden', marginBottom:'var(--space-md)', background:'var(--bg-elevated)' }}>
                      <img src={post.imageUrl} alt={post.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                    {post.category && <span className="badge badge-gold">{post.category}</span>}
                    <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{post.createdAt ? new Date(post.createdAt.seconds*1000).toLocaleDateString() : ''}</span>
                  </div>
                  <h4 style={{ marginBottom:8, fontSize:'0.95rem', lineHeight:1.4 }}>{post.title}</h4>
                  <p style={{ fontSize:'0.83rem', margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{post.excerpt}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'var(--space-2xl) 0', color:'var(--text-muted)' }}>
              <div style={{ fontSize:'2rem', marginBottom:12 }}>📰</div>
              <p style={{ margin:0 }}>News and updates from IBI chapters worldwide will appear here as they're published.</p>
            </div>
          )}
        </div>
      </section>

      <CTASectionAnimated />
    </>
  );
}