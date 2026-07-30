// components/dashboard/VerifyEmailBanner.tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

// Soft nudge for TD-12 (no email verification step). Deliberately NOT a
// hard block on dashboard access — that would lock out every member who
// registered before this existed. Just visible, dismissible-by-verifying,
// and easy to act on.
export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified) return null;

  const resend = async () => {
    setSending(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setSent(true);
      toast.success('Verification email sent — check your inbox');
    } catch {
      toast.error('Could not send verification email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      padding: '10px 16px', marginBottom: 'var(--space-lg)',
      background: 'rgba(212,175,55,0.06)', border: '1px solid var(--border-gold)',
      borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>
        ✉️ Please verify your email address — check your inbox for a link from IBI.
      </span>
      <button onClick={resend} disabled={sending || sent} className="btn btn-gold" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
        {sent ? 'Sent ✓' : sending ? 'Sending…' : 'Resend Email'}
      </button>
    </div>
  );
}
