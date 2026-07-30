// components/dashboard/PinGateModal.tsx
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { setClientPinMode } from '@/lib/pinSessionClient';
import toast from 'react-hot-toast';

interface Props { onUnlock: (mode: 'main' | 'duress') => void; }

export default function PinGateModal({ onUnlock }: Props) {
  const { user } = useAuth();
  const [checking, setChecking]   = useState(true);
  const [hasPin, setHasPin]       = useState(false);
  const [pin, setPin]             = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/wallet/pin/status', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setHasPin(Boolean(data.hasPin));
      } catch {
        setHasPin(false);
      } finally {
        setChecking(false);
      }
    })();
  }, [user]);

  const submitSetup = async () => {
    if (!/^\d{4}$/.test(pin)) { setError('PIN must be exactly 4 digits'); return; }
    if (pin !== confirmPin)   { setError('PINs do not match'); return; }
    setSubmitting(true); setError('');
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/wallet/pin/set', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPin: pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClientPinMode('main');
      toast.success('Wallet PIN set');
      onUnlock('main');
    } catch (e: any) {
      setError(e.message ?? 'Could not set PIN');
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerify = async () => {
    if (!/^\d{4}$/.test(pin)) { setError('Enter your 4-digit PIN'); return; }
    setSubmitting(true); setError('');
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/wallet/pin/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClientPinMode(data.mode);
      onUnlock(data.mode);
    } catch (e: any) {
      setError(e.message ?? 'Incorrect PIN');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return null;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.85)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    }}>
      <div style={{
        background:'var(--bg-elevated)', border:'1px solid var(--border-gold)',
        borderRadius:'var(--radius-xl)', width:'100%', maxWidth:360, padding:'var(--space-xl)',
        textAlign:'center',
      }}>
        <div style={{ fontSize:'2rem', marginBottom:12 }}>🔒</div>

        {hasPin ? (
          <>
            <h3 style={{ marginBottom:6 }}>Enter Your Wallet PIN</h3>
            <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginBottom:20 }}>Required once per session to view your wallet</p>
            <input
              type="password" inputMode="numeric" maxLength={4} autoFocus
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))}
              onKeyDown={e => e.key === 'Enter' && submitVerify()}
              className="form-input" style={{ textAlign:'center', fontSize:'1.5rem', letterSpacing:'0.5em', marginBottom:12 }}
              placeholder="••••"
            />
            {error && <p style={{ color:'var(--ibi-red-light)', fontSize:'0.8rem', marginBottom:12 }}>{error}</p>}
            <button onClick={submitVerify} disabled={submitting || pin.length !== 4} className="btn btn-gold" style={{ width:'100%', justifyContent:'center' }}>
              {submitting ? <span className="spinner" style={{ width:16, height:16 }} /> : 'Unlock'}
            </button>
          </>
        ) : (
          <>
            <h3 style={{ marginBottom:6 }}>Set Up Your Wallet PIN</h3>
            <p style={{ color:'var(--text-muted)', fontSize:'0.82rem', marginBottom:20 }}>
              A 4-digit PIN protects wallet access and transfers. You can add a duress PIN later from Settings.
            </p>
            <input
              type="password" inputMode="numeric" maxLength={4} autoFocus
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))}
              className="form-input" style={{ textAlign:'center', fontSize:'1.5rem', letterSpacing:'0.5em', marginBottom:10 }}
              placeholder="New 4-digit PIN"
            />
            <input
              type="password" inputMode="numeric" maxLength={4}
              value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,''))}
              onKeyDown={e => e.key === 'Enter' && submitSetup()}
              className="form-input" style={{ textAlign:'center', fontSize:'1.5rem', letterSpacing:'0.5em', marginBottom:12 }}
              placeholder="Confirm PIN"
            />
            {error && <p style={{ color:'var(--ibi-red-light)', fontSize:'0.8rem', marginBottom:12 }}>{error}</p>}
            <button onClick={submitSetup} disabled={submitting || pin.length !== 4 || confirmPin.length !== 4} className="btn btn-gold" style={{ width:'100%', justifyContent:'center' }}>
              {submitting ? <span className="spinner" style={{ width:16, height:16 }} /> : 'Set PIN & Continue'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
