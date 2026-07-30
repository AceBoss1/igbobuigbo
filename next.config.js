// next.config.js
/** @type {import('next').NextConfig} */

// Content-Security-Policy is the highest-risk header to get wrong here —
// a mistake silently breaks Paystack checkout or Firebase Auth in
// production rather than throwing an obvious error. Scoped ONLY to
// origins actually confirmed in use in this codebase (grepped, not
// guessed): js.paystack.co (Paystack Inline), Cloudinary + Google profile
// photos (already allowlisted in images.remotePatterns below), and
// Firebase's own API domains for Auth/Firestore. No camera, microphone,
// or geolocation usage exists anywhere in this codebase, so
// Permissions-Policy disables all three outright.
//
// TEST THOROUGHLY ON STAGING BEFORE PRODUCTION: confirm Paystack checkout,
// Firebase login, Cloudinary avatars, and Google profile photos all still
// work with this CSP active. If Firebase Auth ever adds Google Sign-In
// (not currently used — no signInWithPopup/signInWithRedirect found), the
// CSP will need frame-src accounts.google.com added at that point, or the
// sign-in popup will silently fail to load.
// 'unsafe-eval' is required by Next.js DEV MODE's Fast Refresh/HMR — not
// by the actual built app. Dropping it in production tightens the real,
// deployed CSP without breaking local development. 'unsafe-inline'
// stays in both environments: no raw inline <script> tags exist anywhere
// in this codebase (checked), but safely removing 'unsafe-inline' too
// needs a nonce-based CSP (Next.js middleware generating a per-request
// nonce), which isn't confirmed safe against the App Router's own
// hydration internals without live testing — documented here as a
// follow-up, not attempted blind.
const isProd = process.env.NODE_ENV === 'production';
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline' https://js.paystack.co"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.paystack.co",
  "frame-src 'self' https://js.paystack.co https://checkout.paystack.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
  // Removes the "X-Powered-By: Next.js" response header Next.js sets by
  // default — flagged by ZAP as an information-disclosure finding
  // (reveals framework, and can hint at version).
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        // Proxy all Cloudinary images through your own domain.
        // This prevents Edge Tracking Prevention from blocking
        // member avatar images (res.cloudinary.com is flagged as tracker).
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google profile photos
        pathname: '/**',
      },
    ],
  },
  // Ensure TypeScript and ESLint don't block builds
  typescript:  { ignoreBuildErrors: false },
  eslint:      { ignoreDuringBuilds: false },
};

module.exports = nextConfig;
