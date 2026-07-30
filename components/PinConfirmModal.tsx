// components/PinConfirmModal.tsx
//
// A single reusable "enter your PIN to continue" prompt. Every money-moving
// action now requires a FRESH PIN every time (server-enforced — see
// lib/pin.ts requireTransactionPin), not just once per wallet-page session,
// so this gets dropped in right before each transaction is actually
// submitted: transfer, wallet-funded card orders, wallet-funded membership
// upgrades, affiliate withdrawals, and statement generation.
'use client';
import { useState } from 'react';

interface PinConfirmModalProps {
  title?:      string;
  subtitle?:   string;
  /** Should perform the actual request with this pin. Throw with a user-facing message on failure — the modal shows it and stays open so they can retry. Resolve normally on success; the caller is responsible for closing the modal. */
  onConfirm: (pin: string) => Promise<void>;
  onCancel:  () => void;
}

export default function PinConfirmModal({
  title = 'Enter your PIN',
  subtitle = 'Required to confirm this transaction.',
  onConfirm,
  onCancel,
}: PinConfirmModalProps) {
  const [pin, setPin]     = useState('');
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (pin.length !== 4) { setError('Enter your 4-digit PIN'); return; }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(pin);
    } catch (e: any) {
      setError(e?.message ?? 'Incorrect PIN');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', maxWidth: 360, width: '100%',
      }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 4, color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          {subtitle}
        </div>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          disabled={busy}
          style={{
            width: '100%', textAlign: 'center', fontSize: '1.6rem', letterSpacing: '0.6em',
            padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)', color: 'var(--text-primary)', marginBottom: 12,
          }}
          placeholder="••••"
        />

        {error && (
          <div style={{ color: 'var(--ibi-red-light, #f87171)', fontSize: '0.8rem', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy} style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            className="btn btn-gold"
            onClick={submit}
            disabled={busy || pin.length !== 4}
            style={{ flex: 1 }}
          >
            {busy ? 'Verifying…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
