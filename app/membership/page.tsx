// app/membership/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import toast from 'react-hot-toast';

const CHAPTERS = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
  'Diaspora - UK','Diaspora - US','Diaspora - Europe','Diaspora - Africa',
];

const TIERS = [
  { id: 'associate', name: 'Associate',   price: 5000,   desc: 'Digital ID, Newsletter, Basic Wallet' },
  { id: 'full',      name: 'Full Member', price: 15000,  desc: 'Affiliate, IBI Card, Escrow, Voting' },
  { id: 'lifetime',  name: 'Lifetime',    price: 150000, desc: 'All perks, lifetime recognition' },
];

const TRADES = [
  'Trading / Commerce','Real Estate','Agriculture','Technology','Healthcare',
  'Education','Finance / Banking','Manufacturing','Transport / Logistics',
  'Hospitality','Professional Services','Arts / Media','Other',
];

interface FormData {
  firstName: string; lastName: string; email: string; phone: string;
  gender: string; dob: string; state: string; lga: string;
  chapter: string; tier: string; trade: string; referralCode: string;
  nin: string; password: string; confirmPassword: string;
  agreeTerms: boolean;
}

export default function MembershipPage() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') ?? '';
  const tierParam = searchParams.get('tier') ?? 'full';

  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '',
    gender: '', dob: '', state: '', lga: '',
    chapter: '', tier: tierParam, trade: '', referralCode: refCode,
    nin: '', password: '', confirmPassword: '',
    agreeTerms: false,
  });
  const [errors, setErrors]   = useState<Partial<FormData>>({});

  const set = (k: keyof FormData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const selectedTier = TIERS.find(t => t.id === form.tier) ?? TIERS[1];

  // Validation per step
  const validateStep = (s: number): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = 'Required';
      if (!form.lastName.trim())  e.lastName  = 'Required';
      if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
      if (!/^(\+234|0)[789]\d{9}$/.test(form.phone)) e.phone = 'Valid Nigerian phone required';
      if (!form.gender) e.gender = 'Required';
      if (!form.dob)    e.dob    = 'Required';
    }
    if (s === 2) {
      if (!form.chapter) e.chapter = 'Select your chapter';
      if (!form.trade)   e.trade   = 'Select your trade';
    }
    if (s === 3) {
      if (!form.tier) e.tier = 'Select membership tier';
    }
    if (s === 4) {
      if (form.password.length < 8)       e.password = 'Min 8 characters';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
      if (!form.agreeTerms) e.agreeTerms = 'You must agree to terms' as any;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(s => s + 1);
  };

  const handlePayAndSubmit = () => {
    if (!validateStep(4)) return;
    setLoading(true);

    const ref = `IBI-REG-${Date.now()}`;
    const handler = (window as any).PaystackPop.setup({
      key:    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email:  form.email,
      amount: selectedTier.price * 100,
      ref,
      metadata: { form, tier: selectedTier.id },
      currency: 'NGN',
      callback: async (res: { reference: string }) => {
        try {
          const response = await fetch('/api/membership/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, paystackRef: res.reference }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          toast.success(`Welcome to IBI! Your number: ${data.ibiNumber}`);
          setStep(5); // success
        } catch (e: any) {
          toast.error(e.message ?? 'Registration failed');
        } finally { setLoading(false); }
      },
      onClose: () => { setLoading(false); toast.error('Payment cancelled'); },
    });
    handler.openIframe();
  };

  const STEP_LABELS = ['Personal Info', 'Business Info', 'Membership', 'Security'];
  const Field = ({ label, id, children, error }: { label: string; id: string; children: React.ReactNode; error?: string }) => (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );

  return (
    <>
      <Script src="https://js.paystack.co/v1/inline.js" strategy="lazyOnload" />
      <div style={{ minHeight: '100vh', paddingTop: 96, paddingBottom: 'var(--space-3xl)' }}>
        <div className="container-sm">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
            <div className="section-label">Membership Registration</div>
            <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: 8 }}>Join Igbobuigbo</h1>
            <p style={{ color: 'var(--text-muted)' }}>Complete your registration to receive your IBI number and digital ID.</p>
          </div>

          {/* Progress */}
          {step < 5 && (
            <div style={{ marginBottom: 'var(--space-2xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                {STEP_LABELS.map((label, i) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: i + 1 < step ? 'var(--ibi-gold)' : i + 1 === step ? 'var(--ibi-red)' : 'var(--bg-elevated)',
                      border: `2px solid ${i + 1 <= step ? (i + 1 < step ? 'var(--ibi-gold)' : 'var(--ibi-red)') : 'var(--border-subtle)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700,
                      color: i + 1 <= step ? (i + 1 < step ? '#1a0f00' : '#fff') : 'var(--text-muted)',
                      transition: 'all 0.3s',
                    }}>
                      {i + 1 < step ? '✓' : i + 1}
                    </div>
                    <div style={{ fontSize: '0.65rem', marginTop: 4, color: i + 1 === step ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center' }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: 'var(--grad-gold)',
                  borderRadius: 4,
                  width: `${((step - 1) / (STEP_LABELS.length)) * 100}%`,
                  transition: 'width 0.4s var(--ease-out)',
                }} />
              </div>
            </div>
          )}

          {/* Form card */}
          <div className="card-elevated" style={{ padding: 'var(--space-xl)' }}>
            {/* ── STEP 1: Personal Info ──── */}
            {step === 1 && (
              <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 0 }}>Personal Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <Field label="First Name" id="firstName" error={errors.firstName}>
                    <input id="firstName" className="form-input" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Chukwuemeka" />
                  </Field>
                  <Field label="Last Name" id="lastName" error={errors.lastName}>
                    <input id="lastName" className="form-input" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Okafor" />
                  </Field>
                </div>
                <Field label="Email Address" id="email" error={errors.email}>
                  <input id="email" type="email" className="form-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
                </Field>
                <Field label="Phone Number" id="phone" error={errors.phone}>
                  <input id="phone" type="tel" className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="08012345678" />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <Field label="Gender" id="gender" error={errors.gender}>
                    <select id="gender" className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                      <option value="">Select gender</option>
                      <option>Male</option><option>Female</option><option>Prefer not to say</option>
                    </select>
                  </Field>
                  <Field label="Date of Birth" id="dob" error={errors.dob}>
                    <input id="dob" type="date" className="form-input" value={form.dob} onChange={e => set('dob', e.target.value)} />
                  </Field>
                </div>
                <Field label="NIN (National ID Number)" id="nin">
                  <input id="nin" className="form-input" value={form.nin} onChange={e => set('nin', e.target.value)} placeholder="12345678901 (optional)" />
                </Field>
                {refCode && (
                  <div style={{ padding: '10px 14px', background: 'rgba(212,175,55,0.06)', border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-md)', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                    🎉 Referred by code: <strong style={{ color: 'var(--ibi-gold)' }}>{refCode}</strong>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Business Info ──── */}
            {step === 2 && (
              <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 0 }}>Business &amp; Chapter Info</h3>
                <Field label="State of Residence" id="state">
                  <select id="state" className="form-select" value={form.state} onChange={e => set('state', e.target.value)}>
                    <option value="">Select state</option>
                    {CHAPTERS.slice(0, 37).map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="IBI Chapter" id="chapter" error={errors.chapter}>
                  <select id="chapter" className="form-select" value={form.chapter} onChange={e => set('chapter', e.target.value)}>
                    <option value="">Select your chapter</option>
                    {CHAPTERS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Primary Trade / Sector" id="trade" error={errors.trade}>
                  <select id="trade" className="form-select" value={form.trade} onChange={e => set('trade', e.target.value)}>
                    <option value="">Select sector</option>
                    {TRADES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="LGA" id="lga">
                  <input id="lga" className="form-input" value={form.lga} onChange={e => set('lga', e.target.value)} placeholder="Your local government area" />
                </Field>
                <Field label="Referral Code (optional)" id="referralCode">
                  <input id="referralCode" className="form-input" value={form.referralCode} onChange={e => set('referralCode', e.target.value)} placeholder="e.g. IBIAFF12345" />
                </Field>
              </div>
            )}

            {/* ── STEP 3: Tier ──── */}
            {step === 3 && (
              <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 0 }}>Select Membership Tier</h3>
                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                  {TIERS.map(t => (
                    <div
                      key={t.id}
                      onClick={() => set('tier', t.id)}
                      style={{
                        padding: 'var(--space-lg)',
                        background: form.tier === t.id ? 'rgba(212,175,55,0.06)' : 'var(--bg-card)',
                        border: `2px solid ${form.tier === t.id ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%',
                          border: `2px solid ${form.tier === t.id ? 'var(--ibi-gold)' : 'var(--border-subtle)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {form.tier === t.id && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ibi-gold)' }} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{t.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ibi-gold)', fontSize: '1rem', textAlign: 'right', flexShrink: 0 }}>
                        ₦{t.price.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 4: Security ──── */}
            {step === 4 && (
              <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
                <h3 style={{ marginBottom: 0 }}>Account Security</h3>

                {/* Summary */}
                <div style={{
                  padding: 'var(--space-md)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ibi-gold)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 10 }}>ORDER SUMMARY</div>
                  {[
                    ['Name',      `${form.firstName} ${form.lastName}`],
                    ['Email',     form.email],
                    ['Chapter',   form.chapter],
                    ['Tier',      selectedTier.name],
                    ['Amount',    `₦${selectedTier.price.toLocaleString()}`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <Field label="Password" id="password" error={errors.password}>
                  <input id="password" type="password" className="form-input" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 8 characters" />
                </Field>
                <Field label="Confirm Password" id="confirmPassword" error={errors.confirmPassword}>
                  <input id="confirmPassword" type="password" className="form-input" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Repeat password" />
                </Field>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.agreeTerms} onChange={e => set('agreeTerms', e.target.checked)} style={{ marginTop: 3 }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    I agree to the{' '}
                    <Link href="/terms" style={{ color: 'var(--ibi-gold)' }}>Terms of Use</Link> and{' '}
                    <Link href="/privacy" style={{ color: 'var(--ibi-gold)' }}>Privacy Policy</Link> of IBI.
                  </span>
                </label>
                {errors.agreeTerms && <span className="form-error">You must agree to the terms</span>}
              </div>
            )}

            {/* ── STEP 5: Success ──── */}
            {step === 5 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                <div style={{ fontSize: '4rem', marginBottom: 'var(--space-lg)' }}>🎉</div>
                <h2 style={{ marginBottom: 12 }}>Welcome to IBI!</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)' }}>
                  Your registration is under review. Check your email and phone for your IBI number and activation link.
                </p>
                <Link href="/dashboard/overview" className="btn btn-gold btn-lg">Go to Dashboard</Link>
              </div>
            )}

            {/* Navigation buttons */}
            {step < 5 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-subtle)' }}>
                {step > 1 ? (
                  <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>← Back</button>
                ) : <div />}
                {step < 4 ? (
                  <button className="btn btn-primary" onClick={nextStep}>Continue →</button>
                ) : (
                  <button
                    className="btn btn-gold btn-lg"
                    onClick={handlePayAndSubmit}
                    disabled={loading}
                    style={{ gap: 10 }}
                  >
                    {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Processing…</> : `Pay ₦${selectedTier.price.toLocaleString()} & Register`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
