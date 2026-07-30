// app/login/LoginForm.tsx

'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import LogoCircle from '@/components/LogoCircle';
import toast from 'react-hot-toast';

export default function LoginForm() {
  const { user, loading } = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();

  const nextUrl =
    searchParams.get('next') ?? '/dashboard/overview';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    // If we were just redirected here because the server session expired,
    // don't auto-forward based on the client Firebase user — that user
    // object can still be cached locally even though the __session cookie
    // is gone/invalid, and immediately redirecting back to `nextUrl` just
    // sends the middleware right back to /login?expired=1, forever.
    // Let the person actually sign in again; a fresh sign-in re-establishes
    // both the Firebase client session and the server cookie together.
    if (searchParams.get('expired')) return;
    if (!loading && user) {
      router.replace(nextUrl);
    }
  }, [user, loading, router, nextUrl, searchParams]);

  useEffect(() => {
    if (searchParams.get('expired')) {
      toast.error('Session expired. Please sign in again.');
    }
  }, [searchParams]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Enter email and password');
      return;
    }

    if (!auth) {
      toast.error('Firebase authentication not initialized');
      return;
    }

    setSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const idToken = await cred.user.getIdToken(true);

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        throw new Error('Failed to create session');
      }

      toast.success('Welcome back');

      setTimeout(() => {
        router.replace(nextUrl);
      }, 200);
    } catch (err: any) {
      console.error(err);

      switch (err?.code) {
        case 'auth/user-not-found':
          toast.error('Account not found');
          break;

        case 'auth/wrong-password':
          toast.error('Incorrect password');
          break;

        case 'auth/invalid-credential':
          toast.error('Invalid email or password');
          break;

        case 'auth/too-many-requests':
          toast.error('Too many attempts. Try again later.');
          break;

        default:
          toast.error(err?.message || 'Login failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error('Enter your email address');
      return;
    }

    if (!auth) {
      toast.error('Firebase authentication not initialized');
      return;
    }

    setSubmitting(true);

    try {
      await sendPasswordResetEmail(
        auth,
        email.trim()
      );

      toast.success('Password reset email sent');
      setResetMode(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Unable to send reset email');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 72,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 24,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          <LogoCircle size={64} />

          <h2>
            {resetMode
              ? 'Reset Password'
              : 'Welcome Back'}
          </h2>

          <p>
            {resetMode
              ? 'Enter your email to receive a reset link'
              : 'Sign in to your IBI account'}
          </p>
        </div>

        <form
          onSubmit={
            resetMode
              ? handleReset
              : handleLogin
          }
        >
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
          />

          {!resetMode && (
            <>
              <input
                type={
                  showPass
                    ? 'text'
                    : 'password'
                }
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
              />

              <label
                style={{
                  display: 'block',
                  marginTop: 8,
                  marginBottom: 12,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={showPass}
                  onChange={() =>
                    setShowPass(!showPass)
                  }
                />{' '}
                Show password
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Please wait...'
              : resetMode
              ? 'Send Reset Link'
              : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            onClick={() =>
              setResetMode(!resetMode)
            }
          >
            {resetMode
              ? 'Back to Login'
              : 'Forgot Password?'}
          </button>

          {!resetMode && (
            <p>
              Not a member?{' '}
              <Link href="/membership">
                Join IBI
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}