// app/dashboard/idcard/page.tsx
'use client';
import { useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function IDCardPage() {
  const { member } = useAuth();
  const cardRef  = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current!, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `IBI_ID_${member?.ibiNumber?.replace('/', '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // fallback: print
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  if (!member) return null;

  const initials = member.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const joined   = member.joinedAt ? new Date(member.joinedAt).getFullYear() : new Date().getFullYear();
  const expires  = member.expiresAt
    ? new Date(member.expiresAt).toLocaleDateString('en-NG', { month: '2-digit', year: '2-digit' })
    : 'LIFETIME';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--ibi-gold)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
          Digital ID
        </div>
        <h2 style={{ marginBottom: 8 }}>Your IBI Identity Card</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Click the card to flip. Download for offline use or to share with chapter officers.
        </p>
      </div>

      {/* Flip container */}
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          aspectRatio: '1.586 / 1',
          perspective: 1200,
          cursor: 'pointer',
        }}
        onClick={() => setFlipped(f => !f)}
      >
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'none',
        }}>
          {/* FRONT */}
          <div
            ref={cardRef}
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              background: 'linear-gradient(135deg, #0d0d0d 0%, #1a0508 40%, #0d0d0d 100%)',
              borderRadius: 16,
              border: '1.5px solid var(--ibi-gold)',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.1)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-body)',
            }}
          >
            {/* Gold shimmer overlay */}
            <div style={{
              position: 'absolute',
              top: -50, right: -80,
              width: 250, height: 250,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--grad-red)',
                    border: '1.5px solid var(--ibi-gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 900, color: '#fff',
                  }}>IBI</div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ibi-gold)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      Igbobuigbo
                    </div>
                    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
                      Business Union International
                    </div>
                  </div>
                </div>
              </div>
              <div style={{
                padding: '3px 10px',
                background: member.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(200,16,46,0.15)',
                border: `1px solid ${member.status === 'active' ? 'rgba(34,197,94,0.4)' : 'rgba(200,16,46,0.4)'}`,
                borderRadius: 99,
                fontSize: 7,
                fontWeight: 700,
                color: member.status === 'active' ? '#4ade80' : '#f87171',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {member.status === 'active' ? '● ACTIVE' : '● PENDING'}
              </div>
            </div>

            {/* Member info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {member.photoURL ? (
                <img src={member.photoURL} alt="Member photo" style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid var(--ibi-gold)', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--ibi-red-dark), var(--ibi-red))',
                  border: '2px solid var(--ibi-gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 700, color: '#fff',
                  fontFamily: 'var(--font-display)',
                }}>
                  {initials}
                </div>
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'Georgia, serif', marginBottom: 2 }}>
                  {member.displayName}
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {member.trade ?? 'Member'}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--ibi-gold)', letterSpacing: '0.05em' }}>
                  {member.ibiNumber}
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                  Chapter
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                  {member.chapterCode}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                  Tier
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ibi-gold)', textTransform: 'uppercase' }}>
                  {member.membershipTier}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                  Expires
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
                  {expires}
                </div>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #1a0f00 0%, #0a0c10 100%)',
            borderRadius: 16,
            border: '1.5px solid var(--ibi-gold)',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            {/* Magnetic stripe */}
            <div style={{ height: 28, background: '#111', borderRadius: 4, margin: '12px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Dummy signature strip */}
              <div style={{
                flex: 1,
                height: 36,
                background: '#f5f0e8',
                borderRadius: 4,
                marginRight: 16,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 10,
              }}>
                <span style={{ fontFamily: 'cursive', color: '#333', fontSize: 13 }}>
                  {member.displayName.split(' ')[0]}
                </span>
              </div>

              {/* Affiliate code QR placeholder */}
              <div style={{
                width: 60, height: 60,
                background: '#fff',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 7,
                color: '#333',
                textAlign: 'center',
                fontWeight: 700,
                letterSpacing: '0.05em',
                padding: 4,
              }}>
                QR<br/>{member.affiliateCode}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                This card is the property of Igbobuigbo (IBI). If found, please return to the nearest IBI office or call +234 800 IBI IGBO. Member since {joined}.
              </div>
              <div style={{ marginTop: 6, fontSize: 7, color: 'var(--ibi-gold)', letterSpacing: '0.06em' }}>
                igbobuigbo.org.ng · info@igbobuigbo.org.ng
              </div>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Tap card to flip · Shows front &amp; back
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className="btn btn-gold btn-lg"
          onClick={handleDownload}
          disabled={downloading}
          style={{ gap: 10 }}
        >
          {downloading ? (
            <><span className="spinner" style={{ width: 18, height: 18 }} /> Generating…</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download ID Card
            </>
          )}
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'My IBI ID', text: `I am ${member.displayName}, IBI Member ${member.ibiNumber}`, url: 'https://igbobuigbo.org.ng' });
            }
          }}
        >
          Share
        </button>
      </div>

      {/* Info note */}
      <div style={{
        maxWidth: 420,
        padding: '12px 16px',
        background: 'rgba(212,175,55,0.04)',
        border: '1px dashed var(--border-gold)',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        lineHeight: 1.6,
        textAlign: 'center',
      }}>
        Your digital ID is valid for member verification at IBI events and partner businesses. Physical card orders available under{' '}
        <a href="/dashboard/cards" style={{ color: 'var(--ibi-gold)' }}>IBI Cards</a>.
      </div>
    </div>
  );
}
