// app/dashboard/transfer/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { REGIONS, getAllChapters } from '@/lib/chapters-data';
import toast from 'react-hot-toast';

interface Transfer { id:string; ref:string; fromChapter:string; toChapter:string; reason:string; status:string; createdAt:{seconds:number}; effectiveDate:string; }
const STATUS_COLOR: Record<string,string> = { pending:'var(--ibi-gold)', approved:'#4ade80', rejected:'var(--ibi-red-light)', processing:'#60a5fa' };

export default function TransferPage() {
  const { member } = useAuth();
  const [tab,       setTab]       = useState<'form'|'history'>('form');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [success,   setSuccess]   = useState(false);
  const [successRef,setSuccessRef]= useState('');
  const [destRegion,  setDestRegion]  = useState('');
  const [destChapter, setDestChapter] = useState('');
  const [effectiveDate,setEffDate]   = useState('');
  const [reason,      setReason]      = useState('');
  const [explanation, setExplanation] = useState('');
  const [newAddress,  setNewAddress]  = useState('');
  const [declared,    setDeclared]    = useState(false);

  const minDate = new Date(Date.now() + 10*86400000).toISOString().split('T')[0];

  useEffect(() => {
    if (!member || !db) return;
    (async () => {
      setLoading(true);
      try {
        // NO orderBy — sort in JS
        const snap = await getDocs(
          query(collection(db,'transfers'), where('uid','==',member.uid))
        );
        const data = snap.docs
          .map(d => ({ id:d.id, ...d.data() } as Transfer))
          .sort((a,b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setTransfers(data);
      } catch(e:any) { console.error('[transfer]', e.code, e.message); }
      finally { setLoading(false); }
    })();
  }, [member]);

  const destChapters = destRegion ? getAllChapters().filter(c=>c.region===destRegion as any) : [];
  const hasPending   = transfers.some(t=>t.status==='pending');

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault();
    if (!destChapter||!effectiveDate||!reason||!explanation) { toast.error('Fill in all required fields'); return; }
    if (!declared) { toast.error('Please confirm the declaration'); return; }
    if (hasPending) { toast.error('You already have a pending transfer application'); return; }
    if (destChapter === member?.chapter) { toast.error('You are already in this chapter'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/membership/transfer', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ destRegion, destChapter, effectiveDate, reason, explanation, newAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessRef(data.ref);
      setSuccess(true);
      toast.success('Transfer application submitted!');
    } catch(e:any) { toast.error(e.message ?? 'Submission failed'); }
    finally { setSubmitting(false); }
  };

  const TAB = (id:typeof tab, label:string): React.CSSProperties => ({
    padding:'10px 20px', background:tab===id?'var(--bg-card)':'transparent',
    border:'none', borderBottom:`2px solid ${tab===id?'var(--ibi-gold)':'transparent'}`,
    color:tab===id?'var(--ibi-gold)':'var(--text-muted)',
    fontWeight:tab===id?600:400, fontSize:'0.88rem', cursor:'pointer', transition:'all 0.2s',
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-xl)', maxWidth:680 }}>
      <div>
        <div className="section-label">Chapter Services</div>
        <h2 style={{ marginBottom:4 }}>Chapter / Region Transfer</h2>
        <p style={{ color:'var(--text-muted)', fontSize:'0.88rem' }}>Apply to move your membership to another chapter. Your IBI number and history are fully preserved.</p>
      </div>

      <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border-subtle)', overflow:'hidden' }}>
        <div style={{ display:'flex', borderBottom:'1px solid var(--border-subtle)' }}>
          <button style={TAB('form','📋 Transfer Application')} onClick={()=>setTab('form')}>📋 Transfer Application</button>
          <button style={TAB('history',`📁 History ${transfers.length?`(${transfers.length})`:''}`)} onClick={()=>setTab('history')}>
            📁 History {transfers.length ? `(${transfers.length})` : ''}
          </button>
        </div>

        <div style={{ padding:'var(--space-lg)' }}>
          {tab==='form' && (
            success ? (
              <div style={{ textAlign:'center', padding:'var(--space-xl) 0' }}>
                <div style={{ fontSize:'3rem', marginBottom:16 }}>✅</div>
                <h3 style={{ marginBottom:8 }}>Transfer Application Submitted!</h3>
                <div style={{ fontFamily:'var(--font-mono)', color:'var(--ibi-gold)', fontSize:'0.9rem', marginBottom:12 }}>Ref: {successRef}</div>
                <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:24 }}>Processing: 5–10 working days. Track status in Transfer History.</p>
                <button className="btn btn-outline" onClick={()=>{ setSuccess(false); setTab('history'); }}>View Transfer History →</button>
              </div>
            ) : (
              <>
                {hasPending && (
                  <div style={{ padding:'10px 14px', background:'rgba(212,175,55,0.08)', border:'1px solid var(--border-gold)', borderRadius:'var(--radius-md)', fontSize:'0.83rem', color:'var(--text-secondary)', marginBottom:'var(--space-lg)' }}>
                    ⏳ You have a pending transfer. Only one pending transfer allowed at a time.
                  </div>
                )}
                <div style={{ padding:'10px 14px', background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:'var(--radius-md)', fontSize:'0.82rem', color:'var(--text-secondary)', marginBottom:'var(--space-lg)', lineHeight:1.6 }}>
                  ℹ️ Processing takes 5–10 working days. One pending transfer at a time.
                </div>
                <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'var(--space-lg)' }}>

                  {/* Current membership */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'var(--space-md)', paddingBottom:8, borderBottom:'1px solid var(--border-subtle)' }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--ibi-red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:'#fff' }}>1</div>
                      <span style={{ fontWeight:600, fontSize:'0.9rem' }}>Current Membership</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                      <div className="form-group">
                        <label className="form-label">Membership ID</label>
                        <input className="form-input" value={member?.ibiNumber ?? ''} readOnly style={{ opacity:0.7, fontFamily:'var(--font-mono)' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Current Chapter</label>
                        <input className="form-input" value={member?.chapter ? `${member.chapter} Chapter` : ''} readOnly style={{ opacity:0.7 }} />
                      </div>
                    </div>
                  </div>

                  {/* Destination */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'var(--space-md)', paddingBottom:8, borderBottom:'1px solid var(--border-subtle)' }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--ibi-red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:'#fff' }}>2</div>
                      <span style={{ fontWeight:600, fontSize:'0.9rem' }}>Destination</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                      <div className="form-group">
                        <label className="form-label">Destination Region *</label>
                        <select className="form-select" value={destRegion} onChange={e=>{ setDestRegion(e.target.value); setDestChapter(''); }} required>
                          <option value="">— Select —</option>
                          {REGIONS.map(r => <option key={r.id} value={r.id}>{r.code}. {r.label.replace(/Region \d — /,'')}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Destination Chapter *</label>
                        <select className="form-select" value={destChapter} onChange={e=>setDestChapter(e.target.value)} disabled={!destRegion} required>
                          <option value="">{destRegion ? '— Select chapter —' : '— Select region first —'}</option>
                          {destChapters.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)', marginTop:'var(--space-md)' }}>
                      <div className="form-group">
                        <label className="form-label">Effective Date *</label>
                        <input type="date" className="form-input" value={effectiveDate} onChange={e=>setEffDate(e.target.value)} min={minDate} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Reason *</label>
                        <select className="form-select" value={reason} onChange={e=>setReason(e.target.value)} required>
                          <option value="">— Select —</option>
                          {['Permanent Relocation','Work / Employment','Academic / Studies','Family Reasons','Personal Preference','Other'].map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'var(--space-md)', paddingBottom:8, borderBottom:'1px solid var(--border-subtle)' }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--ibi-red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color:'#fff' }}>3</div>
                      <span style={{ fontWeight:600, fontSize:'0.9rem' }}>Details</span>
                    </div>
                    <div className="form-group" style={{ marginBottom:'var(--space-md)' }}>
                      <label className="form-label">Full Explanation *</label>
                      <textarea className="form-textarea" value={explanation} onChange={e=>setExplanation(e.target.value)} placeholder="Explain your transfer reason in detail…" rows={4} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">New Address (if relocating)</label>
                      <textarea className="form-textarea" value={newAddress} onChange={e=>setNewAddress(e.target.value)} placeholder="Full new address…" rows={2} />
                    </div>
                  </div>

                  <div style={{ padding:'10px 14px', background:'rgba(200,16,46,0.06)', border:'1px solid var(--border-red)', borderRadius:'var(--radius-md)', fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
                    ⚠️ False transfer applications may result in suspension or revocation of membership.
                  </div>

                  <label style={{ display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer' }}>
                    <input type="checkbox" checked={declared} onChange={e=>setDeclared(e.target.checked)} style={{ marginTop:3 }} required />
                    <span style={{ fontSize:'0.83rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
                      I confirm all information is accurate and accept that this transfer is subject to administrative approval.
                    </span>
                  </label>

                  <div style={{ display:'flex', gap:12 }}>
                    <button type="submit" className="btn btn-primary" disabled={submitting||hasPending} style={{ gap:10 }}>
                      {submitting ? <><span className="spinner" style={{ width:16, height:16 }} /> Submitting…</> : 'Submit Transfer Application'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={()=>{ setDestRegion(''); setDestChapter(''); setEffDate(''); setReason(''); setExplanation(''); setNewAddress(''); setDeclared(false); }}>Clear</button>
                  </div>
                </form>
              </>
            )
          )}

          {tab==='history' && (
            loading ? (
              <div style={{ padding:'var(--space-xl)', textAlign:'center' }}>
                <div className="spinner" style={{ borderColor:'var(--border-gold)', borderTopColor:'var(--ibi-gold)', margin:'0 auto' }} />
              </div>
            ) : transfers.length === 0 ? (
              <div style={{ padding:'var(--space-xl)', textAlign:'center', color:'var(--text-muted)' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>↔️</div>
                <h4 style={{ marginBottom:8 }}>No Transfer Applications Yet</h4>
                <p style={{ fontSize:'0.85rem', margin:0 }}>Apply from the Transfer Application tab.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {transfers.map(t => (
                  <div key={t.id} style={{ padding:'var(--space-md)', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.8rem', color:'var(--ibi-gold)', marginBottom:4 }}>Ref: {t.ref}</div>
                        <div style={{ fontSize:'0.88rem', fontWeight:600, color:'var(--text-primary)' }}>{t.fromChapter} → {t.toChapter}</div>
                      </div>
                      <span className="badge" style={{ background:`${STATUS_COLOR[t.status]??'var(--text-muted)'}20`, color:STATUS_COLOR[t.status]??'var(--text-muted)', border:`1px solid ${STATUS_COLOR[t.status]??'var(--border-subtle)'}60`, textTransform:'capitalize', flexShrink:0 }}>
                        {t.status}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', display:'flex', gap:16, flexWrap:'wrap' }}>
                      <span>📅 {t.createdAt ? new Date(t.createdAt.seconds*1000).toLocaleDateString() : '—'}</span>
                      <span>⏰ Effective: {t.effectiveDate ?? '—'}</span>
                      <span>📌 {t.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
