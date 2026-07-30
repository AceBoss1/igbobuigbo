// components/HomeBanner.tsx
// Stats bar + feature strip + Who We Are section with video — matching the reference design

'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';

const STATS = [
  { value: '3',    label: 'Active Regions' },
  { value: '43',   label: 'Active Chapters' },
  { value: '774',  label: 'Active Zones' },
  { value: '2019', label: 'Year Founded' },
];

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    title: '3-Gate Escrow',
    desc: 'All cooperative transactions trust-protected & staged',
    bg: 'rgba(200,16,46,0.08)', border: 'rgba(200,16,46,0.2)', color: 'var(--ibi-red-light)',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
    title: 'IBI Debit Cards',
    desc: 'Co-branded Verve & Visa membership cards',
    bg: 'rgba(212,175,55,0.08)', border: 'rgba(212,175,55,0.2)', color: 'var(--ibi-gold)',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
      </svg>
    ),
    title: 'Mobile Apps',
    desc: 'Full platform on Android & iOS — launching 2027',
    bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)', color: '#60a5fa',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    title: 'Advertise With Us',
    desc: 'Reach verified Igbo members — from ₦5,000/week',
    bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', color: '#a78bfa',
  },
];

const WHO_WE_ARE_PILLARS = [
  { icon: '🎭', title: 'Cultural Preservation', desc: 'Safeguarding Igbo language, traditions, arts, and values' },
  { icon: '🌱', title: 'Youth Empowerment',     desc: 'Programs and scholarships for the next generation' },
  { icon: '🤝', title: 'Community Welfare',     desc: 'Support systems and welfare for members in need' },
  { icon: '🌍', title: 'Global Unity',          desc: 'Connecting Igbo across all states and the diaspora' },
];

export default function HomeBanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
    }
  };

  return (
    <>
      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <div style={{ background: 'var(--ibi-red)', borderBottom: '3px solid var(--ibi-gold)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {STATS.map(({ value, label }, i) => (
              <div
                key={label}
                style={{
                  padding: '28px 20px',
                  textAlign: 'center',
                  borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6, fontWeight: 600 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature strip ──────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {FEATURES.map(({ icon, title, desc, bg, border, color }, i) => (
              <div
                key={title}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 16,
                  padding: '28px 24px',
                  borderRight: i < FEATURES.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-md)',
                  background: bg, border: `1px solid ${border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color, flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111', marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Who We Are ─────────────────────────────────────────────── */}
      <section id="about" style={{ padding: 'var(--space-3xl) 0', background: '#fff' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-2xl)', alignItems: 'center' }}>

            {/* Left: Text */}
            <div>
              <div style={{
                display: 'inline-block',
                padding: '5px 14px',
                background: 'rgba(200,16,46,0.06)',
                border: '1px solid rgba(200,16,46,0.2)',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem', fontWeight: 700,
                color: 'var(--ibi-red)', letterSpacing: '0.1em',
                textTransform: 'uppercase', marginBottom: 20,
              }}>
                Who We Are
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, color: '#111', lineHeight: 1.15, marginBottom: 20 }}>
                Preserving Igbo Identity for Generations
              </h2>
              <p style={{ fontSize: '1rem', color: '#4b5563', lineHeight: 1.8, marginBottom: 32 }}>
                Igbo Bu Igbo is a registered cultural and unity initiative dedicated to uniting Igbo people through cultural preservation, community development, and collective empowerment — wherever they may be across Nigeria and the world.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 36 }}>
                {WHO_WE_ARE_PILLARS.map(({ icon, title, desc }) => (
                  <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-md)',
                      background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', flexShrink: 0,
                    }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111', marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Link href="/#about" className="btn btn-primary" style={{ gap: 10 }}>
                Learn More About Us
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </div>

            {/* Right: Video */}
            <div style={{ position: 'relative', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', background: '#000' }}>
              <video
                ref={videoRef}
                src="/video.mp4"
                autoPlay
                loop
                muted
                playsInline
                style={{ width: '100%', display: 'block', maxHeight: 420, objectFit: 'cover' }}
              />
              {/* Caption overlay */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                padding: '40px 24px 20px',
              }}>
                <p style={{ color: '#fff', fontSize: '0.95rem', fontStyle: 'italic', fontWeight: 500, margin: '0 0 6px' }}>
                  "Igbo Bu Igbo" — 'To be Igbo is to embrace community, culture, and collective strength.'
                </p>
                <p style={{ color: 'var(--ibi-gold)', fontSize: '0.8rem', margin: 0 }}>— Motto, Igbo Bu Igbo Initiative</p>
              </div>
              {/* Audio toggle */}
              <button
                onClick={toggleAudio}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 'var(--radius-full)',
                  color: '#fff', fontSize: '0.78rem', fontWeight: 600,
                  padding: '6px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {muted ? (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg> Tap for Audio</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Audio On</>
                )}
              </button>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
