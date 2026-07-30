// components/LogoCircle.tsx
'use client';
import { useState } from 'react';

interface Props {
  size?: number;
  style?: React.CSSProperties;
}

export default function LogoCircle({ size = 40, style }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--grad-red)',
      border: '2px solid var(--ibi-gold)',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>
      {!imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.png"
          alt="Igbo Bu Igbo"
          width={size}
          height={size}
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        /* Fallback: styled IBI text */
        <span style={{
          color: '#fff', fontWeight: 900,
          fontSize: Math.round(size * 0.3),
          fontFamily: 'var(--font-display)',
          lineHeight: 1, letterSpacing: '-0.02em',
        }}>
          IBI
        </span>
      )}
    </div>
  );
}
