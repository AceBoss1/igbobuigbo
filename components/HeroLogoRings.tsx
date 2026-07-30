// components/HeroLogoRings.tsx
// Uses Cloudinary-hosted IBI logo (bypasses /logo.svg 404).
// Radiating ring animation defined inline so it always loads.
'use client';

const LOGO_URL = 'https://res.cloudinary.com/djj49cetb/image/upload/v1782343533/logo_rbsnrr.png';
const LOGO_SVG = 'https://res.cloudinary.com/djj49cetb/image/upload/v1782343254/logo_jtwpdu.svg';

export default function HeroLogoRings() {
  return (
    <>
      {/* Keyframes injected into <head> via style tag — works in both server and client renders */}
      <style>{`
        @keyframes ibiRipple {
          0%   { transform: scale(1);   opacity: 0.65; }
          100% { transform: scale(2.8); opacity: 0;    }
        }
        .ibi-ring {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 2px solid rgba(212,175,55,0.55);
          animation: ibiRipple 2.4s ease-out infinite;
          pointer-events: none;
        }
        .ibi-ring-2 {
          animation-delay: 0.8s;
          border-color: rgba(212,175,55,0.35);
        }
        .ibi-ring-3 {
          animation-delay: 1.6s;
          border-color: rgba(212,175,55,0.2);
        }
      `}</style>

      <div style={{ position:'relative', width:150, height:150, flexShrink:0 }}>
        {/* Three staggered radiating rings */}
        <div className="ibi-ring" />
        <div className="ibi-ring ibi-ring-2" />
        <div className="ibi-ring ibi-ring-3" />

        {/* Logo circle */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: 150, height: 150, borderRadius: '50%',
          border: '4px solid var(--ibi-gold)',
          boxShadow: '0 0 60px rgba(212,175,55,0.25), 0 0 0 8px rgba(212,175,55,0.08)',
          overflow: 'hidden',
          background: '#8B1A1A',
        }}>
          {/* Primary: PNG. SVG as background fallback. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_URL}
            alt="Igbo Bu Igbo"
            width={150} height={150}
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            onError={e => { (e.currentTarget as HTMLImageElement).src = LOGO_SVG; }}
          />
        </div>
      </div>
    </>
  );
}
