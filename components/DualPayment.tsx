// components/DualPayment.tsx
'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

export type PaymentMethod = 'paystack' | 'wallet';

interface DualPaymentProps {
  amount: number;           // in kobo
  email?: string;
  label?: string;
  metadata?: Record<string, unknown>;
  paystackRef: string;
  onSuccess: (method: PaymentMethod, reference?: string) => void;
  onError?: (err: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export default function DualPayment({
  amount,
  email,
  label = 'Pay',
  metadata,
  paystackRef,
  onSuccess,
  onError,
  disabled,
}: DualPaymentProps) {
  const { member } = useAuth();
  const [method,  setMethod]  = useState<PaymentMethod>('paystack');
  const [loading, setLoading] = useState(false);

  const naira = (amount / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
  const walletOk = (member?.walletBalance ?? 0) >= amount / 100;

  const handlePaystack = () => {
    setLoading(true);
    const handler = window.PaystackPop.setup({
      key:       process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email:     email ?? member?.email ?? '',
      amount,
      ref:       paystackRef,
      metadata:  metadata ?? {},
      currency:  'NGN',
      callback: (res: { reference: string }) => {
        setLoading(false);
        onSuccess('paystack', res.reference);
      },
      onClose: () => {
        setLoading(false);
        onError?.('Payment cancelled');
      },
    });
    handler.openIframe();
  };

  const handleWallet = async () => {
    if (!walletOk) { onError?.('Insufficient wallet balance'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/wallet/debit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount / 100, ref: paystackRef, metadata }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Wallet debit failed');
      onSuccess('wallet', data.reference);
    } catch (e: unknown) {
      onError?.((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Method selector */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {(['paystack', 'wallet'] as PaymentMethod[]).map(m => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            style={{
              padding: '14px',
              background: method === m ? 'var(--bg-card)' : 'transparent',
              border: 'none',
              borderBottom: method === m ? '2px solid var(--ibi-gold)' : '2px solid transparent',
              color: method === m ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: method === m ? 600 : 400,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {m === 'paystack' ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                Card / Bank
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                </svg>
                IBI Wallet
              </>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ padding: 'var(--space-lg)' }}>
        {method === 'paystack' ? (
          <div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Amount to pay</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ibi-gold)', fontFamily: 'var(--font-mono)' }}>
                {naira}
              </div>
            </div>
            <div style={{
              padding: '10px 14px',
              background: 'rgba(0,119,74,0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(0,119,74,0.2)',
              marginBottom: 'var(--space-md)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}>
              🔒 Secured by Paystack. Supports cards, bank transfer, USSD, and more.
            </div>
            <button
              className="btn btn-primary"
              onClick={handlePaystack}
              disabled={disabled || loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Processing…</> : `${label} ${naira}`}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Wallet Balance</div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: walletOk ? 'var(--ibi-gold)' : 'var(--ibi-red-light)',
              }}>
                ₦{(member?.walletBalance ?? 0).toLocaleString()}
              </div>
              {!member && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Sign in to use wallet
                </div>
              )}
            </div>

            {/* Deduction preview */}
            {member && (
              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${walletOk ? 'var(--border-gold)' : 'var(--border-red)'}`,
                marginBottom: 'var(--space-md)',
                fontSize: '0.82rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Amount</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{naira}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>After payment</span>
                  <span style={{
                    color: walletOk ? '#4ade80' : 'var(--ibi-red-light)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                  }}>
                    ₦{Math.max(0, (member.walletBalance ?? 0) - amount / 100).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <button
              className={walletOk ? 'btn btn-gold' : 'btn btn-ghost'}
              onClick={handleWallet}
              disabled={disabled || loading || !member || !walletOk}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Debiting…</>
                : !member
                  ? 'Sign in to use Wallet'
                  : !walletOk
                    ? 'Insufficient Balance'
                    : `Pay ${naira} from Wallet`}
            </button>
            {!walletOk && member && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                <a href="/dashboard/wallet" style={{ color: 'var(--ibi-gold)' }}>Top up wallet</a> to use this option
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
