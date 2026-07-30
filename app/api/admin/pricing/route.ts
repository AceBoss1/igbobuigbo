// app/api/admin/pricing/route.ts
// Was: app/admin's Pricing tab wrote directly to Firestore from the browser
// via lib/pricing.ts's savePricingSettings() (client SDK + settings/pricing
// security rule). That's the ONLY admin write in the whole app that ever
// worked that way — every other admin action (credit-wallet, approve-member,
// etc.) goes through a server route using the Admin SDK, which bypasses
// Firestore rules entirely and doesn't depend on the client's ID token
// correctly satisfying isAdmin(). This route matches that established,
// working pattern instead, so pricing saves don't depend on a rules path
// nothing else in the app relies on.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { mergePricingWithDefaults, type PricingSettings } from '@/lib/pricing-shared';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminSnap = await adminDb.collection('admins').doc(auth.uid).get();
    if (!adminSnap.exists) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => null) as Partial<PricingSettings> | null;
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const merged = mergePricingWithDefaults(body);
    await adminDb.collection('settings').doc('pricing').set(merged, { merge: true });

    return NextResponse.json({ success: true, pricing: merged });
  } catch (e: any) {
    console.error('[admin/pricing]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
