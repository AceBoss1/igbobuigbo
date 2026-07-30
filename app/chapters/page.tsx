// app/chapters/page.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { IGBO_STATES, NON_IGBO_STATES, DIASPORA } from '@/lib/chapters-data';

export default function ChaptersPage() {
  const [openRegion,    setOpenRegion]    = useState<number | null>(1);
  const [openContinent, setOpenContinent] = useState<string | null>('African Chapter');

  const toggleRegion = (n: number) => setOpenRegion(prev => prev === n ? null : n);
  const toggleCont   = (l: string) => setOpenContinent(prev => prev === l ? null : l);

  const Chip = ({ label, diaspora }: { label: string; diaspora?: boolean }) => (
    <span style={{ display:'flex', alignItems:'center', gap:6, background:'#faf7f0', border:'1px solid rgba(155,28,28,0.08)', borderRadius:7, padding:'7px 12px', fontSize:'0.8rem', color:'#1a0a00' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: diaspora ? '#6b7280' : '#C8102E', display:'inline-block', flexShrink:0 }} />
      {label}
    </span>
  );

  const ZoneHead = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <div style={{ width:'100%', fontSize:'0.7rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.8px', margin:'12px 0 4px', display:'flex', alignItems:'center', gap:6 }}>
      <span>{icon}</span>{children}
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', paddingTop:72, background:'#fff' }}>

      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#1a0005 0%,#2d0008 50%,#1a0005 100%)', padding:'60px 0 50px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div className="container" style={{ position:'relative' }}>
          <div style={{ display:'flex', gap:20, justifyContent:'center', flexWrap:'wrap', marginBottom:16, fontSize:'0.78rem', color:'rgba(255,255,255,0.55)' }}>
            <span>📍 7 Igbo State Chapters</span>
            <span>🏴 30 Non-Igbo State Chapters</span>
            <span>🌍 6 Diaspora Chapters</span>
          </div>
          <h1 style={{ color:'#fff', marginBottom:12, fontSize:'clamp(2rem,5vw,3.5rem)' }}>
            43 Chapters.<br/><span style={{ color:'var(--ibi-gold)' }}>3 Regions. 1 People.</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,0.65)', maxWidth:580, margin:'0 auto 32px', fontSize:'1rem', lineHeight:1.7 }}>
            Igbo Bu Igbo chapters span every state in Nigeria, FCT Abuja, and 5 continents — connecting Ndi Igbo wherever they are.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link href="/membership" className="btn btn-primary btn-lg">Register &amp; Join Your Chapter</Link>
            <Link href="/dashboard/transfer" className="btn btn-outline btn-lg" style={{ borderColor:'rgba(212,175,55,0.5)', color:'var(--ibi-gold)' }}>
              Apply to Transfer Chapter / Region
            </Link>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background:'var(--ibi-red)', borderBottom:'3px solid var(--ibi-gold)' }}>
        <div className="container">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)' }}>
            {[
              ['43',  'Total Active Chapters', 'Across 3 regions'],
              ['774', 'Active Zones',           'Sub-chapter coverage'],
              ['5',   'Continents Covered',     'Africa · Europe · Americas · Asia · Oceania'],
            ].map(([n,l,s], i) => (
              <div key={l} style={{ padding:'22px 20px', textAlign:'center', borderRight: i<2 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.6rem,3.5vw,2.4rem)', fontWeight:900, color:'#fff', lineHeight:1 }}>{n}</div>
                <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.8)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop:4, fontWeight:600 }}>{l}</div>
                <div style={{ fontSize:'0.65rem', color:'rgba(255,255,255,0.45)', marginTop:2 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ background:'#f9f5ee', padding:'var(--space-3xl) 0' }}>
        <div className="container" style={{ maxWidth:900 }}>

          {/* Summary boxes */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginBottom:28 }}>
            {[
              { n:'7',  lbl:'Igbo Speaking State Chapters', bg:'rgba(155,28,28,0.1)',   c:'#C8102E' },
              { n:'30', lbl:'Non-Igbo State & FCT Chapters', bg:'rgba(201,144,26,0.12)', c:'#D4AF37' },
              { n:'6',  lbl:'Global Diaspora Chapters',      bg:'rgba(26,10,0,0.08)',    c:'#6b7280' },
            ].map(({ n, lbl, bg, c }) => (
              <div key={lbl} style={{ background:'#fff', borderRadius:12, padding:18, display:'flex', alignItems:'center', gap:14, border:'1px solid rgba(155,28,28,0.08)' }}>
                <div style={{ width:44, height:44, borderRadius:10, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:c }}>{n}</span>
                </div>
                <div style={{ fontSize:'0.78rem', color:'#6b7280', lineHeight:1.4 }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* Info note */}
          <div style={{ background:'rgba(155,28,28,0.04)', border:'1px solid rgba(155,28,28,0.12)', borderRadius:8, padding:'10px 16px', fontSize:'0.82rem', color:'#4b5563', marginBottom:24, lineHeight:1.6 }}>
            ℹ️ Click any region to expand chapters. Join your closest chapter to access community programs, events, food sharing, bulk purchasing, and Ajo/Isusu groups in your area.
          </div>

          {/* ── REGION 1 ── */}
          {[
            {
              n: 1, color: '#C8102E', count: '7 Chapters',
              title: 'Region 1 — Igbo Speaking States',
              sub:   'Core Igbo Homeland — South-East & South-South',
              desc:  'These 7 chapters cover the five South-East states — the ancestral Igbo heartland — plus Delta and Rivers states which have significant indigenous Igbo-speaking communities.',
              body: (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {IGBO_STATES.zones.map(zone => (
                    <div key={zone.label} style={{ width:'100%' }}>
                      <ZoneHead icon="⭐">{zone.label}</ZoneHead>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                        {zone.chapters.map(c => <Chip key={c} label={`${c} Chapter`} />)}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              n: 2, color: '#D4AF37', count: '30 Chapters',
              title: 'Region 2 — Non-Igbo Speaking States & FCT',
              sub:   'Igbo Diaspora Within Nigeria — 30 Chapters',
              desc:  'All 30 non-Igbo-speaking states plus FCT Abuja. These chapters serve Igbo people who have settled, worked, or built lives outside the traditional homeland states.',
              body: (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {NON_IGBO_STATES.zones.map(zone => (
                    <div key={zone.label} style={{ width:'100%' }}>
                      <ZoneHead icon="🗺️">{zone.label}</ZoneHead>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                        {zone.chapters.map(c => <Chip key={c} label={`${c} Chapter`} />)}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              n: 3, color: '#374151', count: '6 Chapters',
              title: 'Region 3 — Global Diaspora',
              sub:   'Igbo People Across 5 Continents',
              desc:  'From South Africa to London, New York to Dubai, Malaysia to Sydney — the IBI diaspora region unites Igbo people across the world under one identity.',
              body: (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {DIASPORA.continents.map(cont => (
                    <div key={cont.label} style={{ border:'1px solid rgba(155,28,28,0.08)', borderRadius:10, overflow:'hidden', background:'#f9f5ee' }}>
                      <div onClick={() => toggleCont(cont.label)} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', cursor:'pointer' }}>
                        <span style={{ fontSize:18 }}>{cont.emoji}</span>
                        <span style={{ fontSize:'0.85rem', fontWeight:600, color:'#1a0a00', flex:1 }}>
                          {cont.label}{cont.sub && <span style={{ fontWeight:400, color:'#6b7280', fontSize:'0.72rem' }}> — {cont.sub}</span>}
                        </span>
                        <span style={{ fontSize:'0.72rem', color:'#6b7280', background:'#fff', padding:'3px 10px', borderRadius:10, border:'1px solid rgba(155,28,28,0.07)', flexShrink:0 }}>
                          {cont.countries.length} {cont.countries.length===1 ? 'Chapter' : 'Countries'}
                        </span>
                        <span style={{ transition:'transform 0.3s', transform: openContinent===cont.label ? 'rotate(180deg)' : 'none', fontSize:12, color:'#6b7280' }}>▼</span>
                      </div>
                      {openContinent===cont.label && (
                        <div style={{ padding:'8px 16px 16px', display:'flex', flexWrap:'wrap', gap:8 }}>
                          {cont.label === 'General Diaspora Chapter' && (
                            <div style={{ width:'100%', fontSize:'0.72rem', color:'#6b7280', background:'rgba(201,144,26,0.07)', borderRadius:6, padding:'8px 12px', marginBottom:8, lineHeight:1.55 }}>
                              ℹ️ If your country does not yet have a dedicated chapter, register under General Diaspora and help us establish one.
                            </div>
                          )}
                          {cont.countries.map(c => <Chip key={c} label={c} diaspora />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ),
            },
          ].map(({ n, color, count, title, sub, desc, body }) => (
            <div key={n} style={{ borderRadius:12, border:`1px solid ${openRegion===n ? color : 'rgba(155,28,28,0.1)'}`, overflow:'hidden', background:'#fff', marginBottom:12 }}>
              <div onClick={() => toggleRegion(n)} style={{ display:'flex', alignItems:'center', gap:16, padding:'20px 22px', cursor:'pointer' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, color:'#fff', flexShrink:0 }}>{n}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.95rem', fontWeight:600, color:'#1a0a00' }}>{title}</div>
                  <div style={{ fontSize:'0.74rem', color:'#6b7280', marginTop:2 }}>{sub}</div>
                  {openRegion===n && <div style={{ fontSize:'0.78rem', color:'#6b7280', marginTop:5, lineHeight:1.55 }}>{desc}</div>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
                  <span style={{ fontSize:'0.72rem', fontWeight:600, color:'#6b7280', background:'#f9f5ee', padding:'4px 10px', borderRadius:10 }}>{count}</span>
                  <span style={{ transition:'transform 0.3s', transform: openRegion===n ? 'rotate(180deg)' : 'none', fontSize:12, color:'#6b7280' }}>▼</span>
                </div>
              </div>
              {openRegion===n && (
                <div style={{ padding:'0 22px 22px', borderTop:'1px solid rgba(155,28,28,0.06)' }}>
                  <div style={{ background:`${color}08`, borderRadius:8, padding:'10px 14px', fontSize:'0.78rem', color:'#6b7280', marginBottom:16, marginTop:16, lineHeight:1.6 }}>
                    Click any chapter to view local events and programs in your area.
                  </div>
                  {body}
                </div>
              )}
            </div>
          ))}

          {/* CTA */}
          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', paddingTop:'var(--space-xl)' }}>
            <Link href="/membership" className="btn btn-primary btn-lg">Register &amp; Join Your Chapter</Link>
            <Link href="/dashboard/transfer" className="btn btn-outline btn-lg">Apply to Transfer Chapter / Region</Link>
          </div>

        </div>
      </div>
    </div>
  );
}
