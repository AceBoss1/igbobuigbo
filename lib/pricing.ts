// lib/pricing.ts
// CLIENT-SIDE pricing settings source ('use client' components only).
//
// Reads via GET /api/pricing (Admin SDK server-side) rather than the
// client Firestore SDK directly — this used to depend on the
// settings/pricing security rule being deployed, and a missed
// `firebase deploy --only firestore:rules` meant every read silently fell
// back to DEFAULT_PRICING with no visible error. Routing through a server
// route removes that whole failure mode: reads no longer depend on rules
// deployment at all, matching how every write already worked via
// app/api/admin/pricing.
//
// Shared types/defaults/merge logic live in lib/pricing-shared.ts, which
// this file and lib/pricing-server.ts both import from — keeping this
// file and the server file from ever importing each other (that combo
// broke the webpack build once already — see lib/pricing-server.ts).
import { useEffect, useState } from 'react';
import {
  DEFAULT_PRICING,
  mergePricingWithDefaults,
  type PricingSettings,
  type RegistrationFees,
} from '@/lib/pricing-shared';

export { DEFAULT_PRICING };
export type { PricingSettings, RegistrationFees };

let cache: PricingSettings | null = null;
let inflight: Promise<PricingSettings> | null = null;

/** Fetches (and caches for the session) the admin-configurable pricing doc. */
export async function getPricingSettings(): Promise<PricingSettings> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch('/api/pricing', { cache: 'no-store' });
      if (!res.ok) return DEFAULT_PRICING;
      const data = await res.json();
      const merged = mergePricingWithDefaults(data as Partial<PricingSettings>);
      cache = merged;
      return merged;
    } catch (e) {
      console.error('[pricing] failed to load /api/pricing, using defaults', e);
      return DEFAULT_PRICING;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Admin-panel helper — saves via POST /api/admin/pricing (server-side,
 * admin-checked). Kept here for callers that still import it from
 * lib/pricing, but app/admin/page.tsx now calls the route directly so it
 * can surface the exact error message; this wrapper does the same thing.
 */
export async function savePricingSettings(next: PricingSettings): Promise<void> {
  const res = await fetch('/api/admin/pricing', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Could not save pricing');
  }
  cache = null;
}

/** Call after an admin save if you need OTHER already-open tabs/pages to refetch. */
export function invalidatePricingCache() {
  cache = null;
}

/** React hook wrapper — use this in any page/component that displays pricing. */
export function usePricingSettings() {
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getPricingSettings().then(p => { if (alive) { setPricing(p); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  return { pricing, loading };
}
