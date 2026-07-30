// app/coming-soon/[phase]/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

const PHASES: Record<string, { title:string; subtitle:string; desc:string; icon:string; eta:string; features:string[]; color:string }> = {
  directory: {
    title:'IBI Business Directory', subtitle:'Find & connect with verified Igbo businesses',
    desc:'A searchable, verified directory of all IBI member businesses across all 43 chapters. Filter by state, sector, and membership tier.',
    icon:'🗂️', eta:'Q3 2025', color:'#60a5fa',
    features:['Search by trade, state & chapter','Verified member profiles','Direct messaging','Rating & reviews'],
  },
  escrow: {
    title:'IBI Escrow Service', subtitle:'Secure business transactions between members',
    desc:'A 3-gate escrow system that holds funds until both parties confirm delivery. Powered by IBI Wallet for instant settlement.',
    icon:'🔒', eta:'Q3 2025', color:'var(--ibi-gold)',
    features:['3-gate release system','Dispute resolution','IBI Wallet integration','Transaction history'],
  },
  cooperative: {
    title:'Cooperative Programs Portal', subtitle:'Food sharing, bulk buying, Ajo/Isusu & more',
    desc:'Full digital access to all IBI cooperative community programs — food sharing groups, bulk purchasing from China and local markets, community travel, and Ajo/Isusu savings circles.',
    icon:'🤝', eta:'Q4 2025', color:'#4ade80',
    features:['Food sharing groups','Bulk purchasing portal','Ajo / Isusu digital circles','Community travel groups','3-Gate Escrow trust model'],
  },
  marketplace: {
    title:'Igbo Business Marketplace', subtitle:'Buy Igbo. Support Igbo.',
    desc:'Browse and buy from verified Igbo-owned businesses across all 43 chapters. Fashion, food, electronics, agriculture, services, and artisans — all trusted, all verified.',
    icon:'🛒', eta:'Q1 2026', color:'#f472b6',
    features:['43-chapter coverage','Verified Igbo sellers','Affiliate earnings up to 15%','Secure checkout via IBI Wallet'],
  },
  whistleblower: {
    title:'IBI Whistleblower Portal', subtitle:'Anonymous reporting of fraud & misconduct',
    desc:'A secure, anonymous channel for members to report fraudulent activity, misconduct, or policy violations within the IBI network.',
    icon:'🛡️', eta:'Q4 2025', color:'#a78bfa',
    features:['Full anonymity','Encrypted submissions','Case tracking','Independent review board'],
  },
  insurance: {
    title:'IBI Business Insurance', subtitle:'Affordable cover for Igbo businesses',
    desc:'Group insurance products negotiated exclusively for IBI members — health, business property, goods-in-transit, and trade credit.',
    icon:'🏥', eta:'Q1 2026', color:'#34d399',
    features:['Health insurance','Trade credit cover','Property protection','Claims portal'],
  },
};

const DEFAULT: typeof PHASES[string] = {
  title:'Coming Soon', subtitle:"We're building something great",
  desc:'This feature is currently under development. Join the waitlist to be notified at launch.',
  icon:'⚙️', eta:'TBD', color:'var(--ibi-gold)', features:[],
};

export default function ComingSoonPage() {
  const { phase } = useParams<{ phase: string }>();
  const info = PHASES[phase] ?? DEFAULT;

  const [email,     setEmail]     = useState('');
  const [name,      setName]      = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);

  // Initialise EmailJS once on mount
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
    if (!publicKey) return;
    import('@emailjs/browser').then(({ init }) => {
      init(publicKey);
    }).catch(() => {}); // silently ignore if not installed
  }, []);

  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);

    try {
      // 1. Save to Firestore via API (always works)
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, feature: phase }),
      });

      // 2. Send confirmation email via EmailJS (if configured)
      const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_WAITLIST_TEMPLATE;
      const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (serviceId && templateId && publicKey) {
        try {
          const emailjs = await import('@emailjs/browser');
          await emailjs.send(serviceId, templateId, {
            to_email:  email,
            to_name:   name || email.split('@')[0],
            feature:   info.title,
            eta:       info.eta,
            reply_to:  'info@igbobuigbo.org.ng',
          });
        } catch (emailErr) {
          console.warn('EmailJS send failed (non-critical):', emailErr);
          // Don't throw — waitlist was saved to Firestore
        }
      }

      setSubmitted(true);
      toast.success("You're on the waitlist! 🎉");
    } catch (err: any) {
      toast.error(err.message ?? 'Could not join waitlist. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', paddingTop:96, paddingBottom:'var(--space-3xl)', position:'relative', overflow:'hidden' }}>
      {/* Background orb */}
      <div style={{ position:'absolute', top:'20%', left:'50%', transform:'translateX(-50%)', width:500, height:500, borderRadius:'50%', background:`radial-gradient(circle, ${info.color}12 0%, transparent 65%)`, pointerEvents:'none' }} />

      <div className="container-sm" style={{ textAlign:'center', position:'relative' }}>
        {/* Icon */}
        <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:90, height:90, background:`${info.color}15`, border:`2px solid ${info.color}40`, borderRadius:'50%', fontSize:'2.5rem', marginBottom:'var(--space-lg)', animation:'pulse-gold 2.5s ease-in-out infinite' }}>
          {info.icon}
        </div>

        <div style={{ marginBottom:'var(--space-md)' }}>
          <span className="badge" style={{ background:`${info.color}15`, color:info.color, border:`1px solid ${info.color}40` }}>
            🚀 Launching {info.eta}
          </span>
        </div>

        <h1 style={{ marginBottom:10 }}>{info.title}</h1>
        <p style={{ fontSize:'1.05rem', color:'var(--text-secondary)', marginBottom:8 }}>{info.subtitle}</p>
        <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', maxWidth:520, margin:'0 auto var(--space-xl)' }}>{info.desc}</p>

        {/* Features */}
        {info.features.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', marginBottom:'var(--space-2xl)' }}>
            {info.features.map(f => (
              <div key={f} style={{ padding:'8px 16px', background:'var(--bg-elevated)', border:`1px solid ${info.color}30`, borderRadius:'var(--radius-full)', fontSize:'0.82rem', color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
                {f}
              </div>
            ))}
          </div>
        )}

        {/* Waitlist form */}
        <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-xl)', padding:'var(--space-xl)', maxWidth:440, margin:'0 auto var(--space-xl)' }}>
          {submitted ? (
            <div>
              <div style={{ fontSize:'2.5rem', marginBottom:12 }}>✅</div>
              <h3 style={{ marginBottom:8 }}>You're on the list!</h3>
              <p style={{ color:'var(--text-muted)', fontSize:'0.88rem', margin:0 }}>
                We'll notify <strong style={{ color:'var(--ibi-gold)' }}>{email}</strong> the moment <strong>{info.title}</strong> launches.
              </p>
            </div>
          ) : (
            <>
              <h3 style={{ marginBottom:4 }}>Join the Waitlist</h3>
              <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:'var(--space-lg)' }}>
                Be first in line. Get early access and launch-day perks.
              </p>
              <form onSubmit={handleNotify} style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ justifyContent:'center', gap:10 }}>
                  {loading
                    ? <><span className="spinner" style={{ width:16, height:16 }} /> Adding you…</>
                    : 'Notify Me at Launch'}
                </button>
              </form>
            </>
          )}
        </div>

        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/" className="btn btn-ghost">← Back to Home</Link>
          {!submitted && <Link href="/membership" className="btn btn-outline">Join IBI Now</Link>}
        </div>
      </div>
    </div>
  );
}
