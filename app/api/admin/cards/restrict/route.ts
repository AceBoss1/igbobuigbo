// app/api/admin/cards/restrict/route.ts
// Restricts (or clears a restriction on) one specific card order — kept
// as a separate `restricted` field rather than overloading the existing
// `status` field (which tracks order lifecycle: pending/etc.) so
// restricting a card doesn't destroy the record of what stage it's at.
//
// Note on scope: this updates IBI's own Firestore record of the card,
// which is what this app and its admin panel treat as source of truth.
// It does NOT freeze the card at the actual card network / issuing bank
// level — that needs the Sudo Africa BaaS integration (still in
// partnership talks per project notes) to be live first. Until then,
// this is IBI-side record-keeping and display, not a real-time network
// freeze — worth being explicit about that gap with anyone relying on it.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { requireAdmin } from '@/lib/admins';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      await requireAdmin(auth.uid);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const { cardOrderId, action, reason } = await req.json();
    if (!cardOrderId || (action !== 'restrict' && action !== 'unrestrict')) {
      return NextResponse.json({ error: 'cardOrderId and action ("restrict" or "unrestrict") required' }, { status: 400 });
    }
    if (action === 'restrict' && (!reason || !reason.trim())) {
      return NextResponse.json({ error: 'A reason is required to restrict a card' }, { status: 400 });
    }

    const cardRef  = adminDb.collection('cardOrders').doc(cardOrderId);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) return NextResponse.json({ error: 'Card order not found' }, { status: 404 });

    if (action === 'restrict') {
      await cardRef.update({
        restricted: true, restrictedReason: reason.trim(),
        restrictedBy: auth.uid, restrictedAt: new Date(),
      });
    } else {
      await cardRef.update({
        restricted: false, restrictedReason: null,
        unrestrictedBy: auth.uid, unrestrictedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (e: any) {
    console.error('[admin/cards/restrict]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
