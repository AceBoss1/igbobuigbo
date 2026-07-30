// components/CardImageWithFallback.tsx
'use client';

interface Props {
  src: string;
  alt: string;
  fallbackLabel: string;
  fallbackColor: string;
}

export default function CardImageWithFallback({ src, alt, fallbackLabel, fallbackColor }: Props) {
  return (
    <div style={{ width:'100%', aspectRatio:'1.586/1', background:`linear-gradient(135deg,#1a0008,#2d0010)`, borderRadius:12, overflow:'hidden', border:`1px solid ${fallbackColor}40`, position:'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = 'none';
          const p = el.parentElement;
          if (!p || p.querySelector('[data-fallback]')) return;
          const fb = document.createElement('div');
          fb.setAttribute('data-fallback','1');
          fb.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;`;
          fb.innerHTML = `<div style="font-size:2rem">💳</div><div style="font-size:0.75rem;font-weight:700;color:${fallbackColor};letter-spacing:0.1em;text-transform:uppercase;text-align:center;padding:0 12px">${fallbackLabel}</div>`;
          p.appendChild(fb);
        }}
      />
    </div>
  );
}
