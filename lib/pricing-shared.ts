// lib/pricing-shared.ts
// Pure types, constants, and logic shared by lib/pricing.ts (client) and
// lib/pricing-server.ts (server/API routes). Deliberately has ZERO imports
// of React or the Firebase client SDK — those are only safe in a browser
// bundle. lib/pricing-server.ts previously imported directly from
// lib/pricing.ts, which pulled `react` hooks and `firebase/firestore`
// (client SDK) into every API route that used it (e.g. the webhook),
// breaking the webpack build. This file is the fix: both sides import
// from here, neither imports from the other.
export interface RegistrationFees {
  student: number;      // ₦
  youth: number;         // ₦
  professional: number;  // ₦
  business: number;      // ₦
  diasporaUSD: number;   // $
  patron: number;        // ₦
}

export interface PricingSettings {
  registrationFees: RegistrationFees;
  commissionRate: number;   // e.g. 0.10 = 10%, applied to registration fees
  marketplaceRate: number;  // e.g. 0.05 = 5%, applied to marketplace sales
}

// Canonical values as of the last confirmed pricing update. Only used
// until an admin sets settings/pricing in Firestore — once that doc
// exists, its values take over sitewide.
export const DEFAULT_PRICING: PricingSettings = {
  registrationFees: {
    student: 0,
    youth: 0,
    professional: 50000,
    business: 100000,
    diasporaUSD: 20,
    patron: 2500000,
  },
  commissionRate: 0.10,
  marketplaceRate: 0.05,
};

export function mergePricingWithDefaults(data: Partial<PricingSettings> | undefined): PricingSettings {
  return {
    registrationFees: { ...DEFAULT_PRICING.registrationFees, ...(data?.registrationFees ?? {}) },
    commissionRate:  typeof data?.commissionRate  === 'number' ? data.commissionRate  : DEFAULT_PRICING.commissionRate,
    marketplaceRate: typeof data?.marketplaceRate === 'number' ? data.marketplaceRate : DEFAULT_PRICING.marketplaceRate,
  };
}
