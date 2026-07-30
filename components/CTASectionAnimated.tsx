// components/CTASectionAnimated.tsx
'use client';
import Link from 'next/link';

const LOGO_URL = 'https://res.cloudinary.com/djj49cetb/image/upload/v1782343533/logo_rbsnrr.png';
const LOGO_SVG = 'https://res.cloudinary.com/djj49cetb/image/upload/v1782343254/logo_jtwpdu.svg';

// Fixed star positions — avoids hydration mismatch from Math.random()
const STARS = [
  { top:'8%',  left:'5%',  s:10, d:0,    dur:2.1 },
  { top:'14%', left:'18%', s:7,  d:0.4,  dur:2.6 },
  { top:'4%',  left:'34%', s:12, d:0.8,  dur:2.0 },
  { top:'20%', left:'55%', s:8,  d:0.2,  dur:2.8 },
  { top:'9%',  left:'70%', s:11, d:1.1,  dur:2.3 },
  { top:'17%', left:'88%', s:7,  d:0.6,  dur:2.5 },
  { top:'72%', left:'6%',  s:9,  d:1.3,  dur:2.2 },
  { top:'80%', left:'22%', s:7,  d:0.3,  dur:2.7 },
  { top:'64%', left:'42%', s:13, d:0.9,  dur:2.0 },
  { top:'76%', left:'62%', s:8,  d:0.5,  dur:2.4 },
  { top:'68%', left:'78%', s:10, d:1.4,  dur:2.1 },
  { top:'82%', left:'92%', s:7,  d:0.7,  dur:2.6 },
  { top:'40%', left:'2%',  s:8,  d:1.0,  dur:2.3 },
  { top:'50%', left:'96%', s:9,  d:0.2,  dur:2.8 },
  { top:'3%',  left:'50%', s:8,  d:1.2,  dur:2.2 },
  { top:'90%', left:'50%', s:7,  d:0.8,  dur:2.5 },
  { top:'35%', left:'50%', s:6,  d:1.6,  dur:2.0 },
];

function Star({ size }: { size: number }) {
  const h = size / 2, q = size / 4;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path
        d={`M${h} 0 L${h+q/2} ${h-q/2} L${size} ${h} L${h+q/2} ${h+q/2} L${h} ${size} L${h-q/2} ${h+q/2} L0 ${h} L${h-q/2} ${h-q/2} Z`}
        fill="#D4AF37"
      />
    </svg>
  );
}

export default function CTASectionAnimated() {
  return (
    <section style={{
      padding: 'var(--space-3xl) 0',
      background: 'linear-gradient(135deg, var(--ibi-red-dark) 0%, #1a0508 50%, var(--ibi-red-dark) 100%)',
      textAlign: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ibiSparkle {
          0%,100% { opacity:0; transform:scale(0) rotate(0deg); }
          40%      { opacity:1; transform:scale(1) rotate(144deg); }
          60%      { opacity:.8; transform:scale(1.1) rotate(216deg); }
        }
        .ibi-star {
          position: absolute;
          pointer-events: none;
          animation: ibiSparkle linear infinite;
        }
      `}</style>

      {/* Sparkle stars */}
      {STARS.map((star, i) => (
        <div key={i} className="ibi-star" style={{
          top: star.top, left: star.left,
          animationDuration: `${star.dur}s`,
          animationDelay: `${star.d}s`,
        }}>
          <Star size={star.s} />
        </div>
      ))}

      {/* Content */}
      <div className="container-sm" style={{ position:'relative', zIndex:1 }}>

        {/* Logo circle */}
        <div style={{
          width:90, height:90, borderRadius:'50%',
          border:'3px solid var(--ibi-gold)',
          boxShadow:'0 0 40px rgba(212,175,55,0.3), 0 0 0 6px rgba(212,175,55,0.08)',
          overflow:'hidden', background:'#8B1A1A',
          margin:'0 auto 24px',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_URL}
            alt="Igbo Bu Igbo"
            width={90} height={90}
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            onError={e => { (e.currentTarget as HTMLImageElement).src = LOGO_SVG; }}
          />
        </div>

        <h2 style={{ marginBottom:16, fontSize:'clamp(1.75rem,4vw,2.5rem)', color:'#fff' }}>
          Ready to Join the Movement?
        </h2>
        <p style={{ fontSize:'1.05rem', marginBottom:'var(--space-xl)', color:'rgba(255,255,255,0.7)' }}>
          Over 12,000 Igbo minds are already inside. Your chapter is waiting.
        </p>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/membership" className="btn btn-gold btn-lg">Register Now</Link>
          <Link href="/contact" className="btn btn-ghost btn-lg" style={{ color:'#fff', borderColor:'rgba(255,255,255,0.3)' }}>
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}
