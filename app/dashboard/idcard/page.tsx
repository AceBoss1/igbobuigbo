// app/dashboard/idcard/page.tsx
// KEY PRINCIPLE: The download PNG is a 4× capture of the DISPLAY-SIZE card.
// This guarantees the download looks pixel-identical to what you see on screen.
// No separate "full-size" dl=true path — only one render, one truth.
'use client';
import { useRef, useState, useEffect } from 'react';
import { useAuth }                      from '@/lib/AuthContext';
import Link                             from 'next/link';

// ─── Card dimensions ──────────────────────────────────────────────────────────
// Cards render at DISPLAY SIZE on screen. Downloads capture at 4× = 1920×1208 px.
const DW = 480;   // display width  px
const DH = 303;   // display height px (960/605 ratio ≈ 1.586)

const NETWORKS = [
  { id:'verve',      label:'Verve',      color:'#00b16a', files:['/ibi-verve-card.webp',      '/ibi-verve-card.png']      },
  { id:'afrigo',     label:'AfriGo',     color:'#e67e22', files:['/ibi-afrigo-card.webp',     '/ibi-afrigo-card.png']     },
  { id:'visa',       label:'Visa',       color:'#4a7fff', files:['/ibi-visa-card.webp',       '/ibi-visa-card.png']       },
  { id:'mastercard', label:'Mastercard', color:'#eb001b', files:['/ibi-mastercard-card.webp', '/ibi-mastercard-card.png'] },
];

const PAN_TXT: Record<string, string> = {
  visa:       '4XXX\u2003XXXX\u2003XXXX\u2003XXXX',
  mastercard: '5XXX\u2003XXXX\u2003XXXX\u2003XXXX',
  verve:      'XXXX\u2003XXXX\u2003XXXX\u2003XXXX',
  afrigo:     'XXXX\u2003XXXX\u2003XXXX\u2003XXXX',
};
const IIN_TXT: Record<string, string> = {
  visa:'4XXX', mastercard:'5XXX', verve:'XXXX', afrigo:'XXXX',
};

// Formats a next-of-kin phone number for display. Only assumes Nigeria
// (+234) when there's no evidence otherwise — a number that already has
// its own "+CC" prefix, or a nok.country explicitly set to something
// other than Nigeria, is left as entered rather than overwritten.
function withCC(phone?: string, country?: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();

  // Already international (e.g. "+1 415 555 0100") — keep its own code,
  // just normalise the spacing after it.
  const intl = trimmed.match(/^\+(\d{1,3})\s*(.*)$/);
  if (intl) return `+${intl[1]}\u2003${intl[2]}`;

  // No "+" prefix, and the contact is explicitly non-Nigerian — don't
  // silently attach a Nigerian country code to a foreign local number.
  if (country && country.trim().toLowerCase() !== 'nigeria') return trimmed;

  // Nigerian number (or country unknown — defaults to Nigeria as before).
  return `+234\u2003${trimmed.replace(/^0/, '')}`;
}

const TS = '0 1px 5px rgba(0,0,0,0.99), 0 2px 8px rgba(0,0,0,0.9)';

// ─── Card front ───────────────────────────────────────────────────────────────
function CardFront({ net, member }: { net: typeof NETWORKS[0]; member: any }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [imgErr, setImgErr] = useState(false);
  const initials = (member?.displayName ?? 'IBI')
    .split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{
      width:DW, height:DH, borderRadius:13, overflow:'hidden',
      position:'relative', background:'linear-gradient(135deg,#1a0008,#2d000f)',
      border:`1px solid ${net.color}40`, flexShrink:0,
    }}>
      {/* Base card image */}
      {!imgErr && imgIdx < net.files.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={net.files[imgIdx]} alt={net.label}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
          onError={() => { if (imgIdx+1 < net.files.length) setImgIdx(i=>i+1); else setImgErr(true); }}
        />
      ) : (
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg,#1a0008,#2d000f,${net.color}18)` }} />
      )}

      {/* ── Overlay — all sections ABSOLUTELY POSITIONED ── */}
      <div style={{ position:'absolute', inset:0 }}>

        {/* TOP-RIGHT: OFFICIAL MEMBER badge + photo */}
        <div style={{
          position:'absolute', top:14, right:15,
          width:89, display:'flex', flexDirection:'column', alignItems:'stretch', gap:5,
        }}>
          <div style={{
            padding:'3px 0', textAlign:'center', whiteSpace:'nowrap',
            background:'rgba(0,0,0,0.45)', border:'1px solid rgba(212,175,55,0.85)',
            borderRadius:99, fontSize:6.5, fontWeight:900, color:'#D4AF37',
            letterSpacing:'0.08em', textShadow: TS,
          }}>
            OFFICIAL MEMBER
          </div>
          <div style={{
            height:107, borderRadius:4, border:'1.5px solid rgba(212,175,55,0.9)',
            overflow:'hidden', background:'linear-gradient(135deg,#1a0005,#C8102E)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            {member?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.photoURL} alt="Photo" crossOrigin="anonymous"
                style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center', display:'block' }} />
            ) : (
              <span style={{ color:'#fff', fontWeight:900, fontSize:27, fontFamily:'Georgia,serif', textShadow:TS }}>{initials}</span>
            )}
          </div>
        </div>

        {/* MIDDLE-LEFT: ◀  [chip]  ))) — just below the IBI logo (~33% from top) */}
        <div style={{
          position:'absolute', top:100, left:15,
          display:'flex', alignItems:'center', gap:8,
        }}>
          {/* ◀ triangle */}
          <svg width={9} height={13} viewBox="0 0 9 13" style={{ flexShrink:0 }}>
            <path d="M9 0 L0 6.5 L9 13 Z" fill="rgba(212,175,55,0.8)" />
          </svg>

          {/* EMV chip — 25% bigger (display base was 29×23, now 36×29) */}
          <div style={{
            width:36, height:29, flexShrink:0,
            background:'linear-gradient(135deg,#d4af37,#a07c10)',
            borderRadius:3, padding:2.5,
            display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'1fr 1fr 1fr', gap:1,
          }}>
            {Array.from({length:9}).map((_,i)=>(
              <div key={i} style={{ background:'rgba(0,0,0,0.18)', borderRadius:0.5 }} />
            ))}
          </div>

          {/* ))) 4 concentric right-opening arcs — proper contactless symbol */}
          <svg width={16} height={31} viewBox="0 0 16 31" fill="none" style={{ flexShrink:0, overflow:'visible' }}>
            <path d="M 0 11.5 A 3.5 3.5 0 0 1 0 19.5" stroke="rgba(212,175,55,1)"    strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M 0 9   A 6.5 6.5 0 0 1 0 22"   stroke="rgba(212,175,55,0.85)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M 0 5.5 A 10  10  0 0 1 0 25.5"  stroke="rgba(212,175,55,0.7)"  strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M 0 1.5 A 14  14  0 0 1 0 29.5"  stroke="rgba(212,175,55,0.5)"  strokeWidth="1"   strokeLinecap="round"/>
          </svg>
        </div>

        {/* BOTTOM: PAN → IIN+ValidThru → Name → IBI — absolute from bottom */}
        <div style={{ position:'absolute', bottom:12, left:15, right:15 }}>
          {/* PAN — 50% bigger (display: 27px) */}
          <div style={{
            fontFamily:'monospace', fontSize:27, fontWeight:700, letterSpacing:'0.1em',
            color:'rgba(255,255,255,0.95)', textShadow:TS, lineHeight:1, marginBottom:4,
            overflow:'hidden', whiteSpace:'nowrap',
          }}>
            {PAN_TXT[net.id] ?? 'XXXX\u2003XXXX\u2003XXXX\u2003XXXX'}
          </div>

          {/* IIN + Valid Thru on same row */}
          <div style={{ display:'flex', alignItems:'baseline', gap:12, marginBottom:7 }}>
            <div style={{ fontFamily:'monospace', fontSize:7.5, color:'rgba(255,255,255,0.5)', letterSpacing:'0.1em', textShadow:TS }}>
              {IIN_TXT[net.id] ?? 'XXXX'}
            </div>
            <div>
              <div style={{ fontSize:5.5, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:1.5, textShadow:TS }}>
                Valid Thru
              </div>
              <div style={{ fontFamily:'monospace', fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.92)', textShadow:TS }}>
                XX/XX
              </div>
            </div>
          </div>

          {/* Member name */}
          <div style={{
            fontSize:14, fontWeight:800, color:'#fff', textTransform:'uppercase',
            letterSpacing:'0.07em', textShadow:TS, lineHeight:1, marginBottom:4,
            overflow:'hidden', whiteSpace:'nowrap',
          }}>
            {(member?.displayName ?? 'IBI MEMBER').toUpperCase().slice(0,22)}
          </div>

          {/* IBI number */}
          <div style={{ fontFamily:'monospace', fontSize:8.5, color:'#D4AF37', letterSpacing:'0.06em', fontWeight:600, textShadow:TS }}>
            REG. ID: {member?.ibiNumber ?? 'PENDING APPROVAL'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card back ────────────────────────────────────────────────────────────────
function CardBack({ member, qrDataUrl }: { member: any; qrDataUrl: string }) {
  const m         = member as any;
  const nok       = m?.nextOfKin;
  const bloodType = m?.bloodType;
  const expiryStr = member?.expiresAt
    ? new Date(member.expiresAt).toLocaleDateString('en-NG',{ month:'long', year:'numeric' })
    : 'Lifetime';
  const joinYear  = member?.joinedAt ? new Date(member.joinedAt).getFullYear() : new Date().getFullYear();

  return (
    <div style={{
      width:DW, height:DH, borderRadius:13, overflow:'hidden',
      position:'relative', flexShrink:0,
      background:'linear-gradient(160deg,#140b00 0%,#080a0e 100%)',
      border:'1px solid #D4AF37',
    }}>
      {/* Legal notice — marginTop:5 keeps text away from top edge for printing */}
      <div style={{
        background:'rgba(212,175,55,0.07)', borderBottom:'1px solid rgba(212,175,55,0.2)',
        padding:'5px 15px', marginTop:5,
      }}>
        <p style={{ margin:0, fontSize:6, color:'rgba(255,255,255,0.5)', lineHeight:1.45 }}>
          ⚠ OFFICIAL CARD: This is an official digital membership card of the Igbo Bu Igbo Unity and
          Cultural Preservation Initiative. To verify, scan QR or visit igbobuigbo.org.ng/verify.
          Please accord the bearer whose details appear on this card every due assistance and respect.
          Duplication or falsification is prohibited and punishable under applicable laws.
        </p>
      </div>

      {/* Magnetic stripe */}
      <div style={{ height:26, background:'linear-gradient(180deg,#0e0e0e,#000,#0e0e0e)', margin:'4px 0 0' }} />

      {/* Main content */}
      <div style={{ padding:'8px 17px 0', display:'flex', flexDirection:'column', gap:6 }}>

        {/* Signature + CVV + QR */}
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* Signature strip — solid white */}
          <div style={{
            flex:1, height:23, background:'#fff', borderRadius:2,
            display:'flex', alignItems:'center', padding:'0 7px',
            border:'1px solid #e0e0e0', overflow:'hidden',
          }}>
            <span style={{ fontFamily:'cursive', color:'#333', fontSize:11, marginRight:6, whiteSpace:'nowrap' }}>
              {member?.displayName?.split(' ')[0] ?? ''}
            </span>
            <span style={{ fontSize:4.5, color:'#aaa', letterSpacing:'0.06em', whiteSpace:'nowrap', marginLeft:'auto' }}>
              AUTHORIZED HOLDER'S SIGNATURE — NOT VALID UNLESS SIGNED
            </span>
          </div>
          {/* CVV */}
          <div style={{ textAlign:'center', flexShrink:0 }}>
            <div style={{ fontSize:5.5, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>CVV</div>
            <div style={{ fontFamily:'monospace', fontWeight:800, color:'rgba(255,255,255,0.88)', fontSize:12 }}>XXX</div>
          </div>
          {/* QR — image first, text BELOW */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Scan to verify"
                style={{ width:45, height:45, imageRendering:'pixelated', background:'#fff', padding:1.5, borderRadius:2, display:'block' }} />
            ) : (
              <div style={{ width:45, height:45, background:'rgba(255,255,255,0.07)', borderRadius:2 }} />
            )}
            <div style={{ fontSize:5, color:'rgba(255,255,255,0.35)', marginTop:2, letterSpacing:'0.08em' }}>SCAN TO VERIFY</div>
            <div style={{ fontSize:4.5, color:'#D4AF37', letterSpacing:'0.04em' }}>igbobuigbo.org.ng/verify</div>
          </div>
        </div>

        <div style={{ height:1, background:'rgba(212,175,55,0.22)' }} />

        {/* 4-column single-row member details */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'0 14px' }}>
          {[
            ['CHAPTER',              `${member?.chapterCode ?? ''} Chapter`],
            ['MEMBER CATEGORY',      (member?.membershipTier ?? '').toUpperCase()],
            ['MEMBER SINCE',         `${joinYear}`],
            ['MEMBERSHIP VALID TILL', expiryStr],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <div style={{ fontSize:5.5, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2.5 }}>{lbl}</div>
              <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.92)', lineHeight:1.15 }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ height:1, background:'rgba(212,175,55,0.18)' }} />

        {/* Emergency contact */}
        {nok?.name ? (
          <div>
            <div style={{ fontSize:6, color:'#ff6b6b', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:800, marginBottom:4.5 }}>
              🚨&nbsp; Emergency Contact
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'2px 11px' }}>
              <div>
                <div style={{ fontSize:5.5, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Name</div>
                <div style={{ fontSize:9.5, fontWeight:700, color:'rgba(255,255,255,0.92)', lineHeight:1.2 }}>{nok.name}</div>
                <div style={{ fontSize:6.5, color:'rgba(255,255,255,0.48)', marginTop:1.5 }}>{nok.relationship || 'Next of Kin'}</div>
              </div>
              <div>
                <div style={{ fontSize:5.5, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Phone</div>
                <div style={{ fontSize:9.5, fontWeight:700, color:'rgba(255,255,255,0.92)', fontFamily:'monospace', lineHeight:1.2 }}>{withCC(nok.phone, nok.country)}</div>
                {nok.email && <div style={{ fontSize:6, color:'rgba(255,255,255,0.42)', marginTop:1.5 }}>{nok.email}</div>}
              </div>
              <div>
                <div style={{ fontSize:5.5, color:'rgba(255,255,255,0.38)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>Blood Type</div>
                {bloodType
                  ? <div style={{ fontSize:18, fontWeight:900, color:'#ff6b6b', lineHeight:1 }}>{bloodType}</div>
                  : <div style={{ fontSize:7, color:'rgba(255,255,255,0.22)', fontStyle:'italic' }}>Not set</div>}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize:6.5, color:'rgba(255,255,255,0.22)', fontStyle:'italic' }}>
            Emergency contact not set — add in Profile Settings
          </div>
        )}
      </div>

      {/* Footer — bottom:5 avoids printer cut-off */}
      <div style={{
        position:'absolute', bottom:5, left:0, right:0,
        borderTop:'1px solid rgba(212,175,55,0.18)', padding:'4.5px 17px',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        background:'rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize:7, color:'#D4AF37', fontWeight:700, letterSpacing:'0.06em' }}>igbobuigbo.org.ng</div>
        <div style={{ fontSize:5.5, color:'rgba(255,255,255,0.32)' }}>+234 (0) 806 787 1203 · info@igbobuigbo.org.ng</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IDCardPage() {
  const { member, loading } = useAuth();

  // Hidden refs — same display-size components, captured at scale:4 for download
  const dlFrontRef = useRef<HTMLDivElement>(null);
  const dlBackRef  = useRef<HTMLDivElement>(null);

  const [downloading, setDownloading] = useState<'front'|'back'|null>(null);
  const [flipped,     setFlipped]     = useState(false);
  const [activeNet,   setActiveNet]   = useState(NETWORKS[0]);
  const [qrDataUrl,   setQrDataUrl]   = useState('');

  useEffect(() => {
    if (!member?.ibiNumber) return;
    import('qrcode').then(({ default: QR }) =>
      QR.toDataURL(
        `https://igbobuigbo.org.ng/verify?ref=${member.ibiNumber}`,
        { width:200, margin:1, color:{dark:'#000',light:'#fff'}, errorCorrectionLevel:'M' },
      ).then(setQrDataUrl).catch(console.error)
    );
  }, [member?.ibiNumber]);

  // Capture at scale:4 → 1920×1212 px — pixel-identical to screen at 4× resolution
  const captureEl = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    const h2c    = (await import('html2canvas')).default;
    const canvas = await h2c(ref.current, {
      scale:4, backgroundColor:null, useCORS:true, allowTaint:false, logging:false,
    });
    const a    = document.createElement('a');
    a.download = filename;
    a.href     = canvas.toDataURL('image/png', 1.0);
    a.click();
  };

  const slug = (member?.ibiNumber ?? 'PENDING').replace('/', '_');

  const dl = async (side: 'front'|'back') => {
    setDownloading(side);
    try {
      await captureEl(
        side==='front' ? dlFrontRef : dlBackRef,
        `IBI_Card_${side==='front'?'Front':'Back'}_${slug}.png`,
      );
    } catch { window.print(); }
    finally  { setDownloading(null); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400, flexDirection:'column', gap:16 }}>
      <div className="spinner" style={{ width:40, height:40, borderColor:'var(--border-gold)', borderTopColor:'var(--ibi-gold)' }} />
      <p style={{ color:'var(--text-muted)' }}>Loading your ID card…</p>
    </div>
  );
  if (!member) return (
    <div style={{ textAlign:'center', padding:'var(--space-xl)' }}>
      <p style={{ color:'var(--text-muted)' }}>Member profile unavailable.</p>
      <Link href="/login" className="btn btn-primary" style={{ marginTop:12, display:'inline-flex' }}>Sign In</Link>
    </div>
  );

  return (
    <>
      {/* ══ HIDDEN DOWNLOAD CLONES ════════════════════════════════════════════
          Same CardFront / CardBack components as the flip card.
          Positioned off-screen with NO 3D transforms — html2canvas captures
          them at scale:4, producing a PNG pixel-identical to what's on screen.
          Because it's the same component + same props, layout CANNOT diverge.  */}
      <div style={{ position:'fixed', left:-9999, top:0, pointerEvents:'none', zIndex:-1 }}>
        <div ref={dlFrontRef} style={{ display:'block' }}>
          <CardFront net={activeNet} member={member} />
        </div>
      </div>
      <div style={{ position:'fixed', left:-9999, top:DH+20, pointerEvents:'none', zIndex:-1 }}>
        <div ref={dlBackRef} style={{ display:'block' }}>
          <CardBack member={member} qrDataUrl={qrDataUrl} />
        </div>
      </div>

      {/* ══ VISIBLE PAGE ══════════════════════════════════════════════════════ */}
      <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xl)', maxWidth:DW+40, margin:'0 auto' }}>

        <div>
          <div className="section-label">Digital ID Card</div>
          <h2 style={{ marginBottom:6 }}>My IBI Membership Card</h2>
          <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>
            Tap card to flip · Switch network · Download front or back as print-ready PNG
          </p>
        </div>

        {member.status === 'pending' && (
          <div style={{ padding:'10px 16px', background:'rgba(212,175,55,0.08)', border:'1px solid var(--border-gold)', borderRadius:'var(--radius-md)', fontSize:'0.83rem', color:'var(--text-secondary)' }}>
            ⏳ Membership pending approval. IBI number appears once approved.
          </div>
        )}

        {/* Network selector */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {NETWORKS.map(n => (
            <button key={n.id} onClick={() => setActiveNet(n)} style={{
              padding:'8px 4px', borderRadius:'var(--radius-md)', cursor:'pointer', transition:'all 0.2s',
              border:`1px solid ${activeNet.id===n.id ? n.color : 'var(--border-subtle)'}`,
              background: activeNet.id===n.id ? `${n.color}15` : 'var(--bg-elevated)',
              fontSize:'0.7rem', fontWeight:700, color: activeNet.id===n.id ? n.color : 'var(--text-muted)',
            }}>{n.label}</button>
          ))}
        </div>

        {/* ══ 3D FLIP — renders at display size, no scale wrapper ══
            The flip and the hidden clones use the exact same components.      */}
        <div
          style={{ width:DW, height:DH, perspective:1200, cursor:'pointer', borderRadius:13, flexShrink:0 }}
          onClick={() => setFlipped(f=>!f)}
          title="Tap to flip"
        >
          <div style={{
            width:DW, height:DH, position:'relative',
            transformStyle:'preserve-3d',
            transition:'transform 0.75s cubic-bezier(0.16,1,0.3,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>
            <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden' }}>
              <CardFront net={activeNet} member={member} />
            </div>
            <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', transform:'rotateY(180deg)' }}>
              <CardBack member={member} qrDataUrl={qrDataUrl} />
            </div>
          </div>
        </div>

        {/* Profile nudges */}
        <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', margin:0, lineHeight:1.7 }}>
          {!member.photoURL         && <><Link href="/dashboard/profile" style={{ color:'var(--ibi-gold)' }}>📷 Upload photo</Link> to personalise front · </>}
          {!(member as any).nextOfKin?.name && <><Link href="/dashboard/profile" style={{ color:'var(--ibi-gold)' }}>🚨 Add emergency contact</Link> for card back · </>}
          {!(member as any).bloodType      && <><Link href="/dashboard/profile" style={{ color:'var(--ibi-gold)' }}>🩸 Add blood type</Link> in Profile</>}
        </p>

        {/* Download buttons — 2 rows */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-gold" onClick={() => dl('front')} disabled={!!downloading}
              style={{ gap:8, flex:1, justifyContent:'center' }}>
              {downloading==='front' ? <><span className="spinner" style={{ width:14,height:14 }} /> Generating…</> : '⬇ Download Front'}
            </button>
            <button onClick={() => dl('back')} disabled={!!downloading} style={{
              gap:8, flex:1, justifyContent:'center', padding:'10px 16px',
              borderRadius:'var(--radius-md)', border:'1px solid var(--ibi-gold)',
              color:'var(--ibi-gold)', background:'transparent', cursor:'pointer',
              display:'flex', alignItems:'center', fontSize:'0.88rem', fontWeight:600,
            }}>
              {downloading==='back' ? <><span className="spinner" style={{ width:14,height:14 }} /> Generating…</> : '⬇ Download Back'}
            </button>
          </div>
          <Link href="/dashboard/cards" className="btn btn-ghost" style={{ justifyContent:'center', gap:8 }}>
            💳 Order Physical Card
          </Link>
        </div>

        <div style={{ padding:'12px 16px', background:'rgba(212,175,55,0.04)', border:'1px dashed var(--border-gold)', borderRadius:'var(--radius-md)', fontSize:'0.79rem', color:'var(--text-muted)', lineHeight:1.65, textAlign:'center' }}>
          Downloaded PNG is print-ready at ~305 DPI (1920×1212). Present at IBI events and partner businesses.
        </div>
      </div>
    </>
  );
}
