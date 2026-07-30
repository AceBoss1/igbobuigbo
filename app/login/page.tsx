// app/login/page.tsx
// SERVER COMPONENT — no 'use client'.
// Exports metadata (title) without conflict.
// LoginContent (client component) is wrapped in Suspense so
// useSearchParams() doesn't cause a build error.

import type { Metadata }  from 'next';
import { Suspense }       from 'react';
import LoginContent       from './_LoginContent';

// ── Page metadata (only works in server components) ──────────────────────────
export const metadata: Metadata = {
  title:       'Sign In — Igbo Bu Igbo',
  description: 'Sign in to your IBI member portal account.',
};

// ── Skeleton shown while Suspense resolves ────────────────────────────────────
function LoginSkeleton() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--grad-hero)',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, padding: '0 var(--space-lg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 'var(--space-lg)',
      }}>
        {/* Logo placeholder */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--bg-elevated)',
          border: '2px solid var(--border-gold)',
          animation: 'pulse 1.5s infinite',
        }} />
        {/* Card placeholder */}
        <div style={{
          width: '100%', height: 300,
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          animation: 'pulse 1.5s infinite',
        }} />
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}

// ── Default export ────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}
