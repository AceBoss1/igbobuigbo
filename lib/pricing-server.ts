// lib/pricing-server.ts
// Server-side (firebase-admin) counterpart to lib/pricing.ts. Use this in
// API route handlers. Imports ONLY from lib/pricing-shared.ts (pure types/
// constants/logic, no React or client-SDK deps) — never from lib/pricing.ts
// itself, which is what caused the webpack build failure (it pulled React
// hooks and the Firebase client SDK into the server bundle). Both this
// file and lib/pricing.ts read/write the SAME settings/pricing document,
// so a price change is consistent whether it's read from a page or a route.
import { adminDb } from '@/lib/firebase-admin';
import { DEFAULT_PRICING, mergePricingWithDefaults, type PricingSettings } from '@/lib/pricing-shared';

export async function getPricingSettingsServer(): Promise<PricingSettings> {
  try {
    const snap = await adminDb.collection('settings').doc('pricing').get();
    return snap.exists ? mergePricingWithDefaults(snap.data() as Partial<PricingSettings>) : DEFAULT_PRICING;
  } catch (e) {
    console.error('[pricing-server] failed to load settings/pricing, using defaults', e);
    return DEFAULT_PRICING;
  }
}

export { DEFAULT_PRICING };
export type { PricingSettings };
