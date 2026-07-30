// lib/rateLimit.ts
//
// A fixed-window rate limiter for public API routes (registration,
// waitlist, contact form, session minting, admin bootstrap). There's no
// Redis/Upstash in this stack, and Vercel serverless functions don't share
// in-memory state reliably across invocations, so Firestore is the only
// consistent shared store already available — one extra read+write per
// rate-limited request, which is a fine trade for closing a real spam/
// abuse gap before launch.
//
// NOT used for PIN attempts — those already have their own, better-suited
// defense (per-account lockout counter on the member doc itself, see
// lib/pin.ts) since PIN guessing is inherently scoped to one account, not
// spread across IPs.
import { adminDb } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

/**
 * Fixed-window limiter: allows `limit` requests per `windowSeconds` for a
 * given key. Not perfectly precise at window boundaries (a burst could in
 * theory land 2x limit across a boundary) — a sliding window would be more
 * exact, but a fixed window is simpler, cheaper (one doc read+write, no
 * array of timestamps to prune), and precise enough for the abuse patterns
 * this is actually defending against (scripted spam, not a sophisticated
 * timing attack).
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const ref = adminDb.collection('rateLimits').doc(key);
  const now = Date.now();

  return adminDb.runTransaction(async (tx) => {
    const doc  = await tx.get(ref);
    const data = doc.data();

    const windowStart = data?.windowStart ?? 0;
    const withinWindow = now - windowStart < windowSeconds * 1000;

    if (!doc.exists || !withinWindow) {
      // New window.
      tx.set(ref, { windowStart: now, count: 1, expiresAt: new Date(now + windowSeconds * 2000) });
      return { ok: true };
    }

    const count = data?.count ?? 0;
    if (count >= limit) {
      const retryAfterSeconds = Math.ceil((windowStart + windowSeconds * 1000 - now) / 1000);
      return { ok: false, retryAfterSeconds };
    }

    tx.update(ref, { count: count + 1 });
    return { ok: true };
  });
}

/** Best-effort client IP extraction on Vercel (works behind their proxy). Falls back to a constant bucket if genuinely unavailable — better to under-limit a shared fallback bucket than to throw and take the route down. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** Convenience: rate-limit by IP with a route-specific prefix, returning a ready-to-use 429 response body/status when exceeded, or null when the request should proceed. */
export async function rateLimitByIp(
  req: NextRequest, routeName: string, limit: number, windowSeconds: number,
): Promise<{ status: number; body: { error: string; retryAfterSeconds: number } } | null> {
  const ip = clientIp(req);
  const result = await checkRateLimit(`${routeName}:ip:${ip}`, limit, windowSeconds);
  if (result.ok) return null;
  return {
    status: 429,
    body: { error: 'Too many requests. Please try again shortly.', retryAfterSeconds: result.retryAfterSeconds ?? windowSeconds },
  };
}
