// components/HeroCardShowcase.tsx
// Demo cards for homepage hero + cards section using demo_*.webp images
'use client';

const DEMO_CARDS = [
  { src:'/demo_verve.webp',      alt:'IBI Verve Debit Card',      label:'Verve Debit',      color:'#00b16a' },
  { src:'/demo_afrigo.webp',     alt:'IBI AfriGo Debit Card',     label:'AfriGo Debit',     color:'#e67e22' },
  { src:'/demo_visa.webp',       alt:'IBI Visa Debit Card',        label:'Visa Debit',       color:'#4a7fff' },
  { src:'/demo_mastercard.webp', alt:'IBI Mastercard Debit',       label:'Mastercard Debit', color:'#eb001b' },
];

export default function HeroCardShowcase() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 16,
      maxWidth: 560,
      margin: '0 auto',
    }}>
      {DEMO_CARDS.map((card, i) => (
        <div
          key={card.src}
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${card.color}30`,
            transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)`,
            transition: 'transform 0.3s',
            position: 'relative',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.src}
            alt={card.alt}
            style={{ width:'100%', display:'block', objectFit:'cover' }}
            loading="lazy"
          />
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            background:'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
            padding:'20px 12px 8px',
          }}>
            <span style={{
              background:'rgba(0,0,0,0.5)',
              backdropFilter:'blur(8px)',
              WebkitBackdropFilter:'blur(8px)',
              border:`1px solid ${card.color}60`,
              borderRadius:99,
              padding:'2px 10px',
              fontSize:'0.62rem',
              fontWeight:700,
              color:card.color,
              letterSpacing:'0.1em',
              textTransform:'uppercase',
            }}>
              {card.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
