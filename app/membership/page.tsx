// app/membership/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { openPaystack } from '@/lib/paystack-inline';
import { getAllChapters, REGIONS } from '@/lib/chapters-data';
import { usePricingSettings, type RegistrationFees } from '@/lib/pricing';
import toast from 'react-hot-toast';

// Built from admin-configurable settings/pricing (lib/pricing.ts) — the
// same source the affiliate table and upgrade modal use, so a fee change
// in Firestore updates registration everywhere, not just here.
function buildTiers(fees: RegistrationFees) {
  return [
    {
      id:'student', name:'Student', price:0, currency:'₦', label:'FREE',
      note:'Expires when your undergraduate program ends', popular:false,
      perks:['Digital ID Card','IBI Marketplace, Cooperative Programs, Directory Access','Newsletter','IBI NGN Wallet','Affiliate Program','Grants & Scholarships, Escrow Access','Find jobs on Job Board','Voting Rights (vote weight = 1)'],
    },
    {
      id:'youth', name:'Youth (18–25yrs)', price:0, currency:'₦', label:'FREE',
      note:'Expires when you turn 26 years', popular:true,
      perks:['Digital ID Card','IBI Marketplace, Cooperative Programs, Directory Access','Newsletter','IBI NGN Wallet','Affiliate Program','Grants & Scholarships, Escrow Access','Find jobs on Job Board','Voting Rights (vote weight = 1)'],
    },
    {
      id:'professional', name:'Professional', price:fees.professional, currency:'₦', label:`₦${fees.professional.toLocaleString()}`,
      note:'One-Time · Lifetime', popular:false,
      perks:['Everything in Student/Youth','IBI NGN + USD Wallet','Business Listing','FREE Virtual IBI Debit Card','Apply to be voted for','5 Free tokens yearly on Verification Portal','Post jobs on Job Board','Voting Rights (vote weight = 5)'],
    },
    {
      id:'business', name:'Business', price:fees.business, currency:'₦', label:`₦${fees.business.toLocaleString()}`,
      note:'One-Time · Lifetime', popular:false,
      perks:['Everything in Student/Youth','IBI NGN + USD Wallet','Business Listing','FREE Virtual IBI Debit Card','Apply to be voted for','5 Free tokens yearly on Verification Portal','Post jobs on Job Board','Voting Rights (vote weight = 5)'],
    },
    {
      id:'diaspora', name:'Diaspora', price:fees.diasporaUSD, currency:'$', label:`$${fees.diasporaUSD}`,
      note:'One-Time · Lifetime', popular:false,
      perks:['Everything in Student/Youth','IBI NGN + USD Wallet','Business Listing','FREE Virtual IBI Debit Card','Apply to be voted for','5 Free tokens yearly on Verification Portal','Post jobs on Job Board','Voting Rights (vote weight = 5)'],
    },
    {
      id:'patron', name:'Patron', price:fees.patron, currency:'₦', label:`₦${fees.patron.toLocaleString()}`,
      note:'One-Time · Lifetime', popular:false,
      perks:['Everything in Professional/Business/Diaspora','All Full Member Perks','Priority VIP Support','Lifetime ID Card','Limited edition IBI Gold/Black VIP debit cards','Executive VIP Recognition','Annual Summit Access','Voting Rights (vote weight = 10)'],
    },
  ];
}

const PATRON_NOTE = 'Chapter Executive, Honorary & Board of Trustees (BoT) membership is by appointment — no registration fee. Annual levies and chapter dues may apply separately.';

const TRADES = ['Trading / Commerce','Real Estate','Agriculture','Technology','Healthcare','Education','Finance / Banking','Manufacturing','Transport / Logistics','Hospitality','Professional Services','Arts / Media','Student','Other'];

interface FormData {
  firstName:string; lastName:string; email:string; phone:string;
  gender:string; dob:string; region:string; chapter:string;
  tier:string; trade:string; referralCode:string;
  nin:string; password:string; confirmPassword:string; agreeTerms:boolean;
}

const STEPS = ['Personal Info','Chapter & Trade','Membership Tier','Security'];

export default function MembershipPage() {
const { pricing } = usePricingSettings();
const TIERS = buildTiers(pricing.registrationFees);
const [refCode, setRefCode] = useState('');
const [tierParam, setTierParam] = useState('youth');

useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  setRefCode(params.get('ref') ?? '');
  setTierParam(params.get('tier') ?? 'youth');
}, []);

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    firstName:'', lastName:'', email:'', phone:'',
    gender:'', dob:'', region:'', chapter:'',
    tier:'youth', trade:'', referralCode:'',
    nin:'', password:'', confirmPassword:'', agreeTerms:false,
  });

useEffect(() => {
  setForm(f => ({
    ...f,
    tier: tierParam,
    referralCode: refCode,
  }));
}, [tierParam, refCode]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData,string>>>({});

  const set = (k:keyof FormData, v:string|boolean) => setForm(f=>({...f,[k]:v}));
  const selectedTier = TIERS.find(t=>t.id===form.tier) ?? TIERS[1];
  const isFree = selectedTier.price === 0;

  // Chapters filtered by region
  const chapterOptions = form.region
    ? getAllChapters().filter(c => c.region === form.region as any)
    : getAllChapters();

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (s:number): boolean => {
    const e: Partial<Record<keyof FormData,string>> = {};

    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = 'Required';
      if (!form.lastName.trim())  e.lastName  = 'Required';
      if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';

      // Flexible phone: Nigerian (080…/+234…) OR international (+X…) OR at least 7 digits
      const phone = form.phone.replace(/[\s\-()]/g,'');
      if (!phone || phone.replace(/\+/g,'').length < 7) {
        e.phone = 'Enter a valid phone number';
      }

      if (!form.gender) e.gender = 'Required';
      if (!form.dob)    e.dob    = 'Required';
    }

    if (s === 2) {
      if (!form.chapter) e.chapter = 'Select your chapter';
      if (!form.trade)   e.trade   = 'Select your sector / trade';
    }

    // Step 3: tier is always pre-selected — no validation needed

    if (s === 4) {
      if (form.password.length < 8) e.password = 'Minimum 8 characters';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
      if (!form.agreeTerms) (e as any).agreeTerms = 'You must agree to the terms';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handlePayAndSubmit = async () => {
    if (!validate(4)) return;
    setLoading(true);

    const submitRegistration = async (paystackRef:string) => {
      const res = await fetch('/api/membership/register', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, paystackRef }),
      });
      const data = await res.json().catch(() => ({ error:'Server error' }));
      if (!res.ok) throw new Error(data.error ?? 'Registration failed');
      toast.success('Welcome to Igbo Bu Igbo! 🦅 Check your email to confirm.');
      setStep(5);
    };

    // Free tiers: submit directly — no payment needed
    if (isFree) {
      try { await submitRegistration('FREE-' + Date.now()); }
      catch (e:any) { toast.error(e.message); }
      finally { setLoading(false); }
      return;
    }

    // Paid tiers: open Paystack
    try {
      await openPaystack({
        email:    form.email,
        amount:   selectedTier.currency === '$' ? selectedTier.price * 100 : selectedTier.price * 100,
        currency: selectedTier.currency === '$' ? 'USD' : 'NGN',
        ref:      `IBI-REG-${Date.now()}`,
        metadata: { tier:form.tier, firstName:form.firstName, lastName:form.lastName },
        onSuccess: async (res) => {
          try { await submitRegistration(res.reference); }
          catch (e:any) { toast.error(e.message); }
          finally { setLoading(false); }
        },
        onClose: () => { setLoading(false); toast.error('Payment cancelled'); },
      });
    } catch (e:any) {
      setLoading(false);
      toast.error(e.message ?? 'Could not open payment');
    }
  };

  const Field = ({ label, id, error, children }: { label:string; id:string; error?:string; children:React.ReactNode }) => (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', paddingTop:96, paddingBottom:'var(--space-3xl)' }}>
      <div className="container-sm">

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'var(--space-2xl)' }}>
          <div className="section-label">Membership Registration</div>
          <h1 style={{ fontSize:'clamp(1.75rem,4vw,2.5rem)', marginBottom:8 }}>Join Igbo Bu Igbo</h1>
          <p style={{ color:'var(--text-muted)' }}>
            Complete your registration to receive your IBI membership number and digital ID.
          </p>
          <div style={{ marginTop:12, display:'inline-flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            <span className="badge badge-green">✓ Student — FREE</span>
            <span className="badge badge-green">✓ Youth — FREE</span>
            <span className="badge badge-gold">Professional from ₦{pricing.registrationFees.professional.toLocaleString()}</span>
          </div>
        </div>

        {/* Quick tier overview — step 1 only */}
        {step === 1 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10, marginBottom:'var(--space-xl)' }}>
            {TIERS.map(t => (
              <div key={t.id} onClick={() => set('tier', t.id)} style={{
                padding:'12px 14px', cursor:'pointer', transition:'all 0.2s', position:'relative',
                background: form.tier===t.id ? 'rgba(212,175,55,0.08)' : 'var(--bg-elevated)',
                border:`2px solid ${form.tier===t.id ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`,
                borderRadius:'var(--radius-lg)',
              }}>
                {t.popular && (
                  <div style={{ position:'absolute', top:-10, right:10, background:'var(--grad-gold)', color:'#1a0f00', padding:'2px 10px', borderRadius:'var(--radius-full)', fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase' }}>Popular</div>
                )}
                <div style={{ fontWeight:700, color: form.tier===t.id ? 'var(--ibi-gold)' : 'var(--text-primary)', fontSize:'0.88rem', marginBottom:3 }}>{t.name}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.1rem', fontWeight:900, color:'var(--ibi-gold)', lineHeight:1 }}>{t.label}</div>
                <div style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:4, lineHeight:1.3 }}>{t.note}</div>
              </div>
            ))}
            <div style={{ gridColumn:'1/-1', padding:'8px 14px', background:'rgba(212,175,55,0.04)', border:'1px dashed var(--border-gold)', borderRadius:'var(--radius-md)', fontSize:'0.75rem', color:'var(--text-muted)', lineHeight:1.6 }}>
              ℹ️ {PATRON_NOTE}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {step < 5 && (
          <div style={{ marginBottom:'var(--space-2xl)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              {STEPS.map((label, i) => (
                <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
                  <div style={{
                    width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                    background: i+1 < step ? 'var(--ibi-gold)' : i+1===step ? 'var(--ibi-red)' : 'var(--bg-elevated)',
                    border:`2px solid ${i+1<=step ? (i+1<step ? 'var(--ibi-gold)' : 'var(--ibi-red)') : 'var(--border-subtle)'}`,
                    fontSize:'0.75rem', fontWeight:700,
                    color: i+1<=step ? (i+1<step ? '#1a0f00' : '#fff') : 'var(--text-muted)',
                    transition:'all 0.3s',
                  }}>
                    {i+1 < step ? '✓' : i+1}
                  </div>
                  <div style={{ fontSize:'0.62rem', marginTop:4, color:i+1===step ? 'var(--text-primary)' : 'var(--text-muted)', textAlign:'center' }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ height:4, background:'var(--bg-elevated)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'var(--grad-gold)', borderRadius:4, width:`${((step-1)/STEPS.length)*100}%`, transition:'width 0.4s var(--ease-out)' }} />
            </div>
          </div>
        )}

        <div className="card-elevated" style={{ padding:'var(--space-xl)' }}>

          {/* ── STEP 1: Personal Info ──── */}
          {step===1 && (
            <div style={{ display:'grid', gap:'var(--space-lg)' }}>
              <h3 style={{ marginBottom:0 }}>Personal Information</h3>

              {/* Free tier callout */}
              {isFree && (
                <div style={{ padding:'10px 16px', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'var(--radius-md)', fontSize:'0.85rem', color:'#4ade80', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:'1.2rem' }}>✅</span>
                  <span><strong>{selectedTier.name}</strong> membership is completely free — no payment required.</span>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                <Field label="First Name *" id="fn" error={errors.firstName}>
                  <input id="fn" className="form-input" value={form.firstName} onChange={e=>set('firstName',e.target.value)} placeholder="Chukwuemeka" autoComplete="given-name" />
                </Field>
                <Field label="Last Name *" id="ln" error={errors.lastName}>
                  <input id="ln" className="form-input" value={form.lastName} onChange={e=>set('lastName',e.target.value)} placeholder="Okafor" autoComplete="family-name" />
                </Field>
              </div>
              <Field label="Email Address *" id="em" error={errors.email}>
                <input id="em" type="email" className="form-input" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </Field>
              <Field label="Phone Number *" id="ph" error={errors.phone}>
                <input id="ph" type="tel" className="form-input" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="08012345678 or +1-234-567-8901 (diaspora)" autoComplete="tel" />
                <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4, display:'block' }}>Nigerian: 080xxxxxxxx &nbsp;·&nbsp; Diaspora: include country code e.g. +44…</span>
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'var(--space-md)' }}>
                <Field label="Gender *" id="gn" error={errors.gender}>
                  <select id="gn" className="form-select" value={form.gender} onChange={e=>set('gender',e.target.value)}>
                    <option value="">Select gender</option>
                    <option>Male</option><option>Female</option><option>Prefer not to say</option>
                  </select>
                </Field>
                <Field label="Date of Birth *" id="dob" error={errors.dob}>
                  <input id="dob" type="date" className="form-input" value={form.dob} onChange={e=>set('dob',e.target.value)} />
                </Field>
              </div>
              <Field label="NIN (optional)" id="nin">
                <input id="nin" className="form-input" value={form.nin} onChange={e=>set('nin',e.target.value)} placeholder="11-digit National ID (Nigerian members)" />
              </Field>
              {refCode && (
                <div style={{ padding:'10px 14px', background:'rgba(212,175,55,0.06)', border:'1px solid var(--border-gold)', borderRadius:'var(--radius-md)', fontSize:'0.83rem', color:'var(--text-secondary)' }}>
                  🎉 Referred by code: <strong style={{ color:'var(--ibi-gold)' }}>{refCode}</strong>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Chapter & Trade ──── */}
          {step===2 && (
            <div style={{ display:'grid', gap:'var(--space-lg)' }}>
              <h3 style={{ marginBottom:0 }}>Chapter &amp; Trade</h3>
              <Field label="Region *" id="region">
                <select id="region" className="form-select" value={form.region} onChange={e=>{ set('region',e.target.value); set('chapter',''); }}>
                  <option value="">Select your region</option>
                  {REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </Field>
              <Field label="Chapter *" id="chapter" error={errors.chapter}>
                <select id="chapter" className="form-select" value={form.chapter} onChange={e=>set('chapter',e.target.value)} disabled={!form.region}>
                  <option value="">{form.region ? 'Select your chapter' : '— Select region first —'}</option>
                  {chapterOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Primary Trade / Sector *" id="trade" error={errors.trade}>
                <select id="trade" className="form-select" value={form.trade} onChange={e=>set('trade',e.target.value)}>
                  <option value="">Select your sector / trade</option>
                  {TRADES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Referral Code (optional)" id="ref">
                <input id="ref" className="form-input" value={form.referralCode} onChange={e=>set('referralCode',e.target.value)} placeholder="e.g. IBICHUKW7X3A" />
              </Field>
            </div>
          )}

          {/* ── STEP 3: Tier ──── */}
          {step===3 && (
            <div style={{ display:'grid', gap:'var(--space-lg)' }}>
              <h3 style={{ marginBottom:0 }}>Confirm Membership Tier</h3>
              <p style={{ color:'var(--text-muted)', fontSize:'0.88rem', margin:0 }}>Registration Fees — One-Time · Lifetime Membership</p>
              <div style={{ display:'grid', gap:'var(--space-md)' }}>
                {TIERS.map(t => (
                  <div key={t.id} onClick={()=>set('tier',t.id)} style={{
                    padding:'var(--space-md)', cursor:'pointer', transition:'all 0.2s',
                    background: form.tier===t.id ? 'rgba(212,175,55,0.06)' : 'var(--bg-card)',
                    border:`2px solid ${form.tier===t.id ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`,
                    borderRadius:'var(--radius-lg)',
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${form.tier===t.id ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {form.tier===t.id && <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--ibi-gold)' }} />}
                        </div>
                        <div>
                          <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:'0.92rem' }}>{t.name}</div>
                          <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:2 }}>{t.note}</div>
                        </div>
                      </div>
                      <div style={{ fontFamily:'var(--font-mono)', fontWeight:900, color: t.price===0 ? '#4ade80' : 'var(--ibi-gold)', fontSize:'1rem', flexShrink:0 }}>{t.label}</div>
                    </div>
                    {form.tier===t.id && (
                      <ul style={{ listStyle:'none', padding:'12px 0 0 32px', margin:0, display:'flex', flexDirection:'column', gap:6 }}>
                        {t.perks.slice(0,4).map(p => (
                          <li key={p} style={{ display:'flex', gap:8, fontSize:'0.78rem', color:'var(--text-secondary)', alignItems:'flex-start' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.price===0 ? '#4ade80' : 'var(--ibi-gold)'} strokeWidth="2.5" style={{ flexShrink:0, marginTop:2 }}><polyline points="20,6 9,17 4,12"/></svg>
                            {p}
                          </li>
                        ))}
                        {t.perks.length>4 && <li style={{ fontSize:'0.72rem', color:'var(--text-muted)', paddingLeft:20 }}>+{t.perks.length-4} more perks</li>}
                      </ul>
                    )}
                  </div>
                ))}
                <div style={{ padding:'8px 14px', background:'rgba(212,175,55,0.04)', border:'1px dashed var(--border-gold)', borderRadius:'var(--radius-md)', fontSize:'0.75rem', color:'var(--text-muted)', lineHeight:1.6 }}>
                  ℹ️ {PATRON_NOTE}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Security + Summary ──── */}
          {step===4 && (
            <div style={{ display:'grid', gap:'var(--space-lg)' }}>
              <h3 style={{ marginBottom:0 }}>Account Security</h3>

              {/* Summary */}
              <div style={{ padding:'var(--space-md)', background:'var(--bg-card)', border:'1px solid var(--border-gold)', borderRadius:'var(--radius-lg)' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--ibi-gold)', fontWeight:600, letterSpacing:'0.05em', marginBottom:10, textTransform:'uppercase' }}>Registration Summary</div>
                {[
                  ['Name',    `${form.firstName} ${form.lastName}`],
                  ['Email',   form.email],
                  ['Chapter', form.chapter],
                  ['Tier',    selectedTier.name],
                  ['Fee',     isFree ? 'FREE — No payment required' : selectedTier.label],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', padding:'5px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                    <span style={{ color:'var(--text-muted)' }}>{k}</span>
                    <span style={{ color: k==='Fee' && isFree ? '#4ade80' : 'var(--text-primary)', fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>

              <Field label="Password *" id="pw" error={errors.password}>
                <input id="pw" type="password" className="form-input" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" />
              </Field>
              <Field label="Confirm Password *" id="cpw" error={errors.confirmPassword}>
                <input id="cpw" type="password" className="form-input" value={form.confirmPassword} onChange={e=>set('confirmPassword',e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
              </Field>
              <label style={{ display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer' }}>
                <input type="checkbox" checked={form.agreeTerms} onChange={e=>set('agreeTerms',e.target.checked)} style={{ marginTop:3 }} />
                <span style={{ fontSize:'0.85rem', color:'var(--text-secondary)' }}>
                  I agree to the <Link href="/terms" style={{ color:'var(--ibi-gold)' }}>Terms of Use</Link> and <Link href="/privacy" style={{ color:'var(--ibi-gold)' }}>Privacy Policy</Link> of Igbo Bu Igbo.
                </span>
              </label>
              {(errors as any).agreeTerms && <span className="form-error">You must agree to the terms to proceed</span>}
            </div>
          )}

          {/* ── STEP 5: Success ──── */}
          {step===5 && (
            <div style={{ textAlign:'center', padding:'var(--space-xl) 0' }}>
              <div style={{ fontSize:'4rem', marginBottom:'var(--space-lg)' }}>🎉</div>
              <h2 style={{ marginBottom:12 }}>Welcome to Igbo Bu Igbo!</h2>
              <p style={{ color:'var(--text-secondary)', marginBottom:'var(--space-xl)', maxWidth:480, margin:'0 auto var(--space-xl)' }}>
                Your registration is under review. Check your email and phone — you'll receive your IBI membership number once approved (24–48 hours).
              </p>
              <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
                <Link href="/login" className="btn btn-gold btn-lg">Sign In to Dashboard</Link>
                <Link href="/" className="btn btn-ghost">Back to Home</Link>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 5 && (
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'var(--space-xl)', paddingTop:'var(--space-lg)', borderTop:'1px solid var(--border-subtle)' }}>
              {step > 1
                ? <button className="btn btn-ghost" onClick={() => setStep(s=>s-1)}>← Back</button>
                : <div />
              }
              {step < 4
                ? <button className="btn btn-primary" onClick={() => { if(validate(step)) setStep(s=>s+1); }}>Continue →</button>
                : (
                  <button
                    className="btn btn-gold btn-lg"
                    onClick={handlePayAndSubmit}
                    disabled={loading}
                    style={{ gap:10 }}
                  >
                    {loading
                      ? <><span className="spinner" style={{ width:16, height:16 }} /> Processing…</>
                      : isFree
                        ? '✅ Register Free →'
                        : `Pay ${selectedTier.label} & Register →`}
                  </button>
                )
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
