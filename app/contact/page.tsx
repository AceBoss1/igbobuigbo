// app/contact/page.tsx
'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';

const DEPARTMENTS = [
  'General Inquiry', 'Membership Support', 'Technical Support',
  'Affiliate / Payments', 'Business Directory', 'Media / Press', 'Other',
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', dept: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill in required fields');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to send');
      setSent(true);
      toast.success('Message sent! We\'ll respond within 24 hours.');
    } catch {
      toast.error('Could not send message. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const CONTACT_INFO = [
    { icon: '📍', label: 'Head Office', value: '14 Zik Avenue, Awka, Anambra State, Nigeria' },
    { icon: '📞', label: 'Phone',        value: '+234 800 IBI IGBO' },
    { icon: '✉️', label: 'Email',        value: 'info@igbobuigbo.org.ng' },
    { icon: '🕐', label: 'Hours',        value: 'Mon – Fri: 8am – 6pm WAT' },
  ];

  return (
    <div style={{ minHeight: '100vh', paddingTop: 96, paddingBottom: 'var(--space-3xl)' }}>
      <div className="container" style={{ maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <div className="section-label">Get In Touch</div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: 12 }}>Contact IBI</h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: 520, margin: '0 auto' }}>
            Have a question, partnership inquiry, or need member support? Our team is ready to help.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-2xl)' }}>
          {/* Left: info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {CONTACT_INFO.map(({ icon, label, value }) => (
              <div key={label} style={{
                display: 'flex',
                gap: 'var(--space-md)',
                padding: 'var(--space-md)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ibi-gold)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{value}</div>
                </div>
              </div>
            ))}

            {/* Social */}
            <div style={{
              padding: 'var(--space-lg)',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--ibi-gold)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
                Follow IBI
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { label: 'Facebook',  href: 'https://facebook.com/igbobuigbo',  color: '#1877F2' },
                  { label: 'Twitter/X', href: 'https://twitter.com/igbobuigbo',   color: '#fff' },
                  { label: 'Instagram', href: 'https://instagram.com/igbobuigbo', color: '#E1306C' },
                  { label: 'LinkedIn',  href: 'https://linkedin.com/company/igbobuigbo', color: '#0077B5' },
                  { label: 'YouTube',   href: 'https://youtube.com/@igbobuigbo',  color: '#FF0000' },
                ].map(({ label, href, color }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="badge"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.color = color; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right: form */}
          <div>
            {sent ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 'var(--space-2xl)',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-gold)',
                gap: 'var(--space-lg)',
              }}>
                <div style={{ fontSize: '4rem' }}>✅</div>
                <h3>Message Received!</h3>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  Thank you, <strong>{form.name}</strong>. Our team will respond to <strong>{form.email}</strong> within 24 business hours.
                </p>
                <button className="btn btn-outline" onClick={() => { setForm({ name:'',email:'',phone:'',dept:'',subject:'',message:'' }); setSent(false); }}>
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-subtle)',
                padding: 'var(--space-xl)',
                display: 'grid',
                gap: 'var(--space-md)',
              }}>
                <h3 style={{ marginBottom: 0 }}>Send a Message</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Adaeze Obi" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="08012345678" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={form.dept} onChange={e => set('dept', e.target.value)}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject *</label>
                  <input className="form-input" value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief subject of your inquiry" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Message *</label>
                  <textarea
                    className="form-textarea"
                    value={form.message}
                    onChange={e => set('message', e.target.value)}
                    placeholder="Describe your inquiry in detail…"
                    rows={5}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ justifyContent: 'center', gap: 10 }}
                >
                  {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Sending…</> : (
                    <>
                      Send Message
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
