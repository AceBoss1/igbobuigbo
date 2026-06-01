// app/page.tsx
import { Suspense } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Igbobuigbo — Igbo Business Union International',
};

// ── Data fetching (SSR) ──────────────────────────────────────
async function getEvents() {
  try {
    const snap = await getDocs(
      query(collection(db, 'events'), where('active', '==', true), orderBy('date', 'desc'), limit(3))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  } catch { return []; }
}

async function getNews() {
  try {
    const snap = await getDocs(
      query(collection(db, 'news'), where('published', '==', true), orderBy('createdAt', 'desc'), limit(6))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  } catch { return []; }
}

async function getStats() {
  try {
    const snap = await getDocs(collection(db, 'stats'));
    return snap.docs[0]?.data() ?? {};
  } catch { return {}; }
}

// ── Components ───────────────────────────────────────────────
const STATS = [
  { value: '12,000+', label: 'Active Members' },
  { value: '36',      label: 'State Chapters' },
  { value: '₦2.4B',  label: 'Transactions Facilitated' },
  { value: '15+',     label: 'Diaspora Chapters' },
];

const TIERS = [
  {
    name: 'Associate',
    price: '₦5,000',
    period: '/year',
    color: 'var(--text-muted)',
    border: 'var(--border-subtle)',
    perks: ['Digital ID Card', 'IBI Directory Access', 'Newsletter', 'Basic Wallet'],
  },
  {
    name: 'Full Member',
    price: '₦15,000',
    period: '/year',
    color: 'var(--ibi-gold)',
    border: 'var(--border-gold)',
    featured: true,
    perks: ['Everything in Associate', 'Affiliate Program', 'Business Listing', 'IBI Debit Card', 'Escrow Access', 'Voting Rights'],
  },
  {
    name: 'Lifetime',
    price: '₦150,000',
    period: ' once',
    color: 'var(--ibi-red-light)',
    border: 'var(--border-red)',
    perks: ['All Full Member Perks', 'Priority Support', 'Lifetime ID Card', 'Executive Recognition', 'Annual Summit Access'],
  },
];

// ── Page ─────────────────────────────────────────────────────
export default async function HomePage() {
  const [events, news] = await Promise.all([getEvents(), getNews()]);

  return (
    <>
      {/* ── HERO ─────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--grad-hero)',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 100,
      }}>
        {/* Decorative orbs */}
        <div style={{ position: 'absolute', top: '10%', right: '-5%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,16,46,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container">
          <div style={{ maxWidth: 720 }}>
            <div className="badge badge-gold animate-fade-in-up" style={{ marginBottom: 24 }}>
              🦅 Igbo Business Union International
            </div>
            <h1 className="animate-fade-in-up delay-100" style={{ marginBottom: 24, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', lineHeight: 1.1 }}>
              United in <span style={{ color: 'var(--ibi-gold)' }}>Purpose,</span>{' '}
              Stronger in <span style={{ color: 'var(--ibi-red-light)' }}>Business</span>
            </h1>
            <p className="animate-fade-in-up delay-200" style={{ fontSize: '1.15rem', lineHeight: 1.8, marginBottom: 40, maxWidth: 580 }}>
              IBI connects Igbo entrepreneurs, traders, and professionals across all 36 states and the global diaspora — fostering economic solidarity, mentorship, and collective prosperity.
            </p>
            <div className="animate-fade-in-up delay-300" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link href="/membership" className="btn btn-primary btn-lg">
                Join IBI Today
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
              <Link href="/#about" className="btn btn-outline btn-lg">Learn More</Link>
            </div>

            {/* Quick stats */}
            <div className="animate-fade-in-up delay-400" style={{
              display: 'flex',
              gap: 'var(--space-xl)',
              marginTop: 'var(--space-2xl)',
              flexWrap: 'wrap',
            }}>
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--ibi-gold)', lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.05em' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ─────────────────────────────────────── */}
      <section id="about" className="section">
        <div className="container">
          <div className="divider-gold" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-2xl)', alignItems: 'center' }}>
            <div>
              <div className="section-label">About IBI</div>
              <h2 className="section-title">
                A Network Built on Igbo Values &amp; Economic Power
              </h2>
              <p className="section-desc" style={{ marginBottom: 'var(--space-lg)' }}>
                IBI was founded on the principle of <em>Igwe bu ike</em> — unity is strength. We provide the infrastructure for Igbo business people to connect, transact, and grow together, regardless of their state chapter or location.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Chapter-based membership across all 36 states', 'IBI Wallet for inter-member transactions', 'Escrow service for business deals', 'Annual business summits and networking events'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--ibi-gold)', marginTop: 2, flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{
              background: 'var(--grad-card)',
              border: '1px solid var(--border-gold)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-xl)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)' }} />
              {[
                { label: 'Year Founded', value: '2020', icon: '📅' },
                { label: 'Total Members', value: '12,000+', icon: '👥' },
                { label: 'States Active', value: '36/36', icon: '🗺️' },
                { label: 'Diaspora Chapters', value: '15+', icon: '🌍' },
                { label: 'Annual Revenue', value: '₦2.4B+', icon: '💰' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>{icon}</span> {label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ibi-gold)', fontSize: '0.95rem' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MEMBERSHIP TIERS ──────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
            <div className="section-label">Membership</div>
            <h2 className="section-title">Choose Your Tier</h2>
            <p className="section-desc" style={{ margin: '0 auto' }}>
              Every Igbo entrepreneur deserves a seat at the table. Pick the plan that fits your journey.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-lg)' }}>
            {TIERS.map(({ name, price, period, color, border, featured, perks }) => (
              <div key={name} style={{
                background: 'var(--grad-card)',
                border: `1px solid ${border}`,
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-xl)',
                position: 'relative',
                transform: featured ? 'scale(1.03)' : 'none',
                boxShadow: featured ? 'var(--shadow-gold)' : 'none',
              }}>
                {featured && (
                  <div style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--grad-gold)',
                    color: '#1a0f00',
                    padding: '4px 20px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    Most Popular
                  </div>
                )}
                <div style={{ color, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {name}
                </div>
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)' }}>{price}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{period}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {perks.map(perk => (
                    <li key={perk} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.87rem', color: 'var(--text-secondary)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 3 }}>
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                      {perk}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/membership?tier=${name.toLowerCase().replace(' ', '-')}`}
                  className={featured ? 'btn btn-gold' : 'btn btn-outline'}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EVENTS ─────────────────────────────────────── */}
      {events.length > 0 && (
        <section className="section">
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-xl)' }}>
              <div>
                <div className="section-label">Events</div>
                <h2 className="section-title" style={{ marginBottom: 0 }}>Upcoming Gatherings</h2>
              </div>
              <Link href="/events" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
              {events.map((ev: any) => (
                <div key={ev.id} className="card">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
                    <div style={{
                      width: 52,
                      height: 52,
                      background: 'rgba(200,16,46,0.1)',
                      border: '1px solid var(--border-red)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--ibi-red-light)', lineHeight: 1 }}>
                        {new Date(ev.date?.seconds * 1000).getDate()}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {new Date(ev.date?.seconds * 1000).toLocaleString('en', { month: 'short' })}
                      </div>
                    </div>
                    <div>
                      <h4 style={{ marginBottom: 4, fontSize: '0.95rem' }}>{ev.title}</h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📍 {ev.location}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.83rem', margin: 0 }}>{ev.excerpt}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── NEWS ─────────────────────────────────────── */}
      {news.length > 0 && (
        <section id="news" className="section" style={{ background: 'var(--bg-secondary)' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-xl)' }}>
              <div>
                <div className="section-label">News</div>
                <h2 className="section-title" style={{ marginBottom: 0 }}>Latest from IBI</h2>
              </div>
              <Link href="/news" className="btn btn-ghost btn-sm">View All</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
              {news.map((post: any) => (
                <Link key={post.id} href={`/news/${post.slug}`} className="card" style={{ display: 'block', textDecoration: 'none' }}>
                  {post.imageUrl && (
                    <div style={{
                      height: 160,
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      marginBottom: 'var(--space-md)',
                      background: 'var(--bg-elevated)',
                    }}>
                      <img src={post.imageUrl} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {post.category && <span className="badge badge-gold">{post.category}</span>}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h4 style={{ marginBottom: 8, fontSize: '0.95rem', lineHeight: 1.4 }}>{post.title}</h4>
                  <p style={{ fontSize: '0.83rem', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {post.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA BANNER ─────────────────────────────────── */}
      <section style={{
        padding: 'var(--space-3xl) 0',
        background: 'linear-gradient(135deg, var(--ibi-red-dark) 0%, #1a0508 50%, var(--ibi-red-dark) 100%)',
        textAlign: 'center',
      }}>
        <div className="container-sm">
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🦅</div>
          <h2 style={{ marginBottom: 16, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}>
            Ready to Join the Movement?
          </h2>
          <p style={{ fontSize: '1.05rem', marginBottom: 'var(--space-xl)', color: 'rgba(255,255,255,0.7)' }}>
            Over 12,000 Igbo business minds are already inside. Your chapter is waiting.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/membership" className="btn btn-gold btn-lg">Register Now</Link>
            <Link href="/contact" className="btn btn-ghost btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
