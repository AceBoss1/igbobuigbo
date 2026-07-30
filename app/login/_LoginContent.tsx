// app/login/_LoginContent.tsx
// Client component — contains all login form logic.
// Imported by app/login/page.tsx (server component) inside a Suspense boundary.
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams }               from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth }      from '@/lib/firebase';
import { useAuth }   from '@/lib/AuthContext';
import toast         from 'react-hot-toast';

export default function LoginContent() {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const searchParams      = useSearchParams();

  // Destination after login. Primary source: the ibi_redirect_next cookie
  // set by middleware.ts / dashboard/layout.tsx — this avoids the %2F
  // redirect bug that came from relying on a `?next=` query string
  // surviving Vercel's edge redirect pipeline in production (see
  // middleware.ts for the full explanation). Query param kept only as a
  // fallback for any old bookmarked/shared /login?next=... links.
  const [nextUrl, setNextUrl] = useState<string>(searchParams.get('next') ?? '/dashboard/overview');
  const expired = searchParams.get('expired');

  useEffect(() => {
    const cookieMatch = document.cookie.match(/(?:^|;\s*)ibi_redirect_next=([^;]*)/);
    if (cookieMatch) {
      setNextUrl(decodeURIComponent(cookieMatch[1]));
      // One-time use — clear it so a later unrelated login doesn't reuse it.
      document.cookie = 'ibi_redirect_next=; path=/; max-age=0';
    }
  }, []);

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetMode,  setResetMode]  = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(nextUrl);
    if (expired)          toast.error('Session expired. Please sign in again.');
    if (searchParams.get('verified')) toast.success('Email verified! Please sign in.');
  }, [user, loading, router, nextUrl, expired, searchParams]);

  // ── Submit handlers ─────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter email and password'); return; }
    if (!auth) { toast.error('Sign-in is not available right now — please try again shortly'); return; }
    setSubmitting(true);
    try {
      const cred    = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await fetch('/api/auth/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken }),
      });
      toast.success('Welcome back!');
      router.replace(nextUrl);
    } catch (e: any) {
      const msgs: Record<string, string> = {
        'auth/user-not-found':     'No account found with this email',
        'auth/wrong-password':     'Incorrect password',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/too-many-requests':  'Too many attempts — try again later',
        'auth/user-disabled':      'This account has been suspended',
      };
      toast.error(msgs[e.code] ?? 'Sign in failed');
    } finally { setSubmitting(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email address'); return; }
    if (!auth) { toast.error('Password reset is not available right now — please try again shortly'); return; }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Reset link sent — check your inbox');
      setResetMode(false);
    } catch { toast.error('Could not send reset email'); }
    finally  { setSubmitting(false); }
  };

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--grad-hero)',
      }}>
        <div className="spinner" style={{
          width: 32, height: 32,
          borderColor: 'var(--border-gold)',
          borderTopColor: 'var(--ibi-gold)',
        }} />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--grad-hero)',
      padding: '80px var(--space-lg) var(--space-xl)',
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '15%', left: '50%',
        transform: 'translateX(-50%)',
        width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,16,46,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>

        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--grad-red)',
            border: '2px solid var(--ibi-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-md)',
            overflow: 'hidden',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Igbo Bu Igbo"
              width={72} height={72}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              onError={e => {
                const img = e.currentTarget;
                img.style.display = 'none';
                const parent = img.parentElement;
                if (parent) {
                  parent.innerHTML = `<svg viewBox="0 0 100 100" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="50" fill="#C8102E"/>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#D4AF37" stroke-width="2"/>
                    <ellipse cx="50" cy="38" rx="14" ry="10" fill="#fff" opacity="0.9"/>
                    <path d="M20 45 Q35 30 50 38 Q65 30 80 45 Q65 50 50 44 Q35 50 20 45Z" fill="#D4AF37"/>
                    <ellipse cx="50" cy="52" rx="8" ry="12" fill="#fff" opacity="0.9"/>
                    <text x="50" y="78" font-family="Georgia,serif" font-size="14" font-weight="900" fill="#D4AF37" text-anchor="middle" letter-spacing="2">IBI</text>
                  </svg>`;
                }
              }}
            />
          </div>

          <h2 style={{ marginBottom: 6, fontSize: '1.6rem' }}>
            {resetMode ? 'Reset Password' : 'Welcome Back'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            {resetMode
              ? 'Enter your email to receive a reset link'
              : 'Sign in to your IBI member account'}
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-xl)',
        }}>
          <form
            onSubmit={resetMode ? handleReset : handleLogin}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
          >
            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email" className="form-input"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email" required disabled={submitting}
              />
            </div>

            {/* Password */}
            {!resetMode && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'} className="form-input"
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password" required disabled={submitting}
                    style={{ paddingRight: 48 }}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '0.9rem', padding: 4, lineHeight: 1,
                    }}
                    tabIndex={-1} aria-label={showPass ? 'Hide password' : 'Show password'}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="btn btn-primary" disabled={submitting}
              style={{ justifyContent: 'center', gap: 10, marginTop: 4, fontSize: '0.95rem' }}>
              {submitting ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} />{' '}
                  {resetMode ? 'Sending…' : 'Signing in…'}
                </>
              ) : (
                resetMode ? 'Send Reset Link' : 'Sign In →'
              )}
            </button>
          </form>

          {/* Footer links */}
          <div style={{
            marginTop: 'var(--space-lg)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <button type="button"
              onClick={() => { setResetMode(r => !r); setPassword(''); }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--ibi-gold)', fontSize: '0.85rem', cursor: 'pointer', padding: 4,
              }}>
              {resetMode ? '← Back to Sign In' : 'Forgot password?'}
            </button>

            {!resetMode && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                Not a member?{' '}
                <Link href="/membership" style={{ color: 'var(--ibi-gold)', fontWeight: 600 }}>
                  Join IBI →
                </Link>
              </p>
            )}
          </div>
        </div>

        {/* Small print */}
        <p style={{
          textAlign: 'center', marginTop: 'var(--space-lg)',
          fontSize: '0.75rem', color: 'var(--text-muted)',
        }}>
          By signing in you agree to IBI&apos;s{' '}
          <Link href="/contact" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
            Terms &amp; Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
