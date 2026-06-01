// components/AffiliateButton.tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

interface AffiliateButtonProps {
  compact?: boolean;
}

export default function AffiliateButton({ compact = false }: AffiliateButtonProps) {
  const { member } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!member) return null;

  const affiliateUrl = `https://igbobuigbo.org.ng/membership?ref=${member.affiliateCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(affiliateUrl);
      setCopied(true);
      toast.success('Affiliate link copied!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Join IBI — Igbo Business Union International',
      text: `Join me on IBI — the premier Igbo business network. Use my referral link to register:`,
      url: affiliateUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); }
      catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleCopy}
          style={{ gap: 6 }}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ibi-gold)" strokeWidth="2.5">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          )}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleShare}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-gold)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
    }}>
      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--ibi-gold)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          Your Affiliate Link
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Earn ₦500 commission for every new member you refer
        </div>
      </div>

      {/* Link display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        marginBottom: 'var(--space-md)',
        overflow: 'hidden',
      }}>
        <code style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          fontFamily: 'var(--font-mono)',
        }}>
          {affiliateUrl}
        </code>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn btn-gold"
          onClick={handleCopy}
          style={{ flex: 1, justifyContent: 'center', gap: 8 }}
        >
          {copied ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
              Link Copied!
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy Link
            </>
          )}
        </button>
        <button
          className="btn btn-outline"
          onClick={handleShare}
          style={{ gap: 8 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
      </div>

      {/* Code badge */}
      <div style={{ marginTop: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Your code:</span>
        <code style={{
          padding: '3px 10px',
          background: 'rgba(212,175,55,0.1)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.82rem',
          color: 'var(--ibi-gold)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          letterSpacing: '0.05em',
        }}>
          {member.affiliateCode}
        </code>
      </div>
    </div>
  );
}
