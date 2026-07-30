// app/api/pricing/route.ts
//
// Public (no auth) read endpoint for settings/pricing, via the Admin SDK.
//
// Likely root cause of "admin save said successful, but nothing changed
// anywhere and reverted on refresh": lib/pricing.ts's usePricingSettings()
// previously read settings/pricing directly with the CLIENT SDK, which
// depends on the settings/pricing Firestore rule actually being deployed
// (`firebase deploy --only firestore:rules`) — having the rule in the repo
// isn't enough, it has to be pushed. If that deploy step was missed, every
// client-side read has been silently denied and falling back to
// DEFAULT_PRICING the whole time — which matches "reverted to status quo
// on refresh" exactly: the "status quo" being shown IS the hardcoded
// default, unrelated to whatever was actually saved.
//
// The admin SAVE already went through the Admin SDK (app/api/admin/pricing)
// and bypasses rules entirely, which is why it reported success correctly
// even if this exact problem was happening. Routing the READ through the
// Admin SDK too removes the dependency on rules deployment for pricing
// altogether — both sides now go through a server route, consistent with
// every other admin-sensitive flow in this app.
import { NextResponse } from 'next/server';
import { getPricingSettingsServer } from '@/lib/pricing-server';

export async function GET() {
  const pricing = await getPricingSettingsServer();
  return NextResponse.json(pricing, { headers: { 'Cache-Control': 'no-store' } });
}
