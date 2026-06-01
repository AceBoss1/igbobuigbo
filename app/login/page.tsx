// app/login/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextUrl      = searchParams.get('next') ?? '/dashboard/overview';
  const expired      = searchParams.get('expired');

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [resetMode,   setResetMode]   = useState(false);
  const [showPass,    setShowPass]    = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(nextUrl);
    if (expired) toast.error('Session expired. Please sign in again.');
  }, [user, loading, router, nextUrl, expired]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter email and password'); return; }
    setSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Set session cookie for middleware
      const token = await cred.user.getIdToken();
      document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax`;
      toast.success('Welcome back!');
      router.replace(nextUrl);
    } catch (e: any) {
      const msg: Record<string, string> = {
        'auth/user-not-found':    'No account with this email',
        'auth/wrong-password':    'Incorrect password',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
        'auth/invalid-credential':'Invalid email or password',
      };
      toast.error(msg[e.code] ?? 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email address'); return; }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent!');
      setResetMode(false);
    } catch { toast.error('Could not send reset email'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 72,
      background: 'var(--grad-hero)',
      position: 'relative',
    }}>
      {/* Background orb */}
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,16,46,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, padding: '0 var(--space-lg)', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--grad-red)',
            border: '2px solid var(--ibi-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-md)',
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, fontFamily: 'var(--font-display)' }}>IBI</span>
          </div>
          <h2 style={{ marginBottom: 4 }}>{resetMode ? 'Reset Password' : 'Welcome Back'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {resetMode ? 'Enter your email to receive a reset link' : 'Sign in to your IBI account'}
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-xl)',
        }}>
          <form onSubmit={resetMode ? handleReset : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            {!resetMode && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem',
                    }}
                  >
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ justifyContent: 'center', gap: 10, marginTop: 4 }}
            >
              {submitting
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> {resetMode ? 'Sending…' : 'Signing in…'}</>
                : resetMode ? 'Send Reset Link' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setResetMode(r => !r)}
              style={{ background: 'none', border: 'none', color: 'var(--ibi-gold)', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {resetMode ? '← Back to Sign In' : 'Forgot password?'}
            </button>

            {!resetMode && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Not a member?{' '}
                <Link href="/membership" style={{ color: 'var(--ibi-gold)', fontWeight: 600 }}>Join IBI →</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
