// app/api/admin/pnd/route.ts
// Sets or clears a PND (Post No Debit) restriction on a member — a
// protective action, not a money-movement one, so regular admin access
// is enough (only credit/debit itself is superadmin-restricted). While
// active, the member can still see their balance and still RECEIVE
// money — lib/wallet.ts only blocks the sender side of a debit.
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

    const { identifier, action, reason } = await req.json();
    if (!identifier || (action !== 'set' && action !== 'clear')) {
      return NextResponse.json({ error: 'identifier and action ("set" or "clear") required' }, { status: 400 });
    }
    if (action === 'set' && (!reason || !reason.trim())) {
      return NextResponse.json({ error: 'A reason is required to place a PND restriction' }, { status: 400 });
    }

    const id = identifier.trim();
    let memberRef: FirebaseFirestore.DocumentReference | null = null;

    const directSnap = await adminDb.collection('members').doc(id).get();
    if (directSnap.exists) {
      memberRef = directSnap.ref;
    } else {
      const allSnap = await adminDb.collection('members').limit(500).get();
      const idUpper = id.toUpperCase(), idLower = id.toLowerCase();
      for (const doc of allSnap.docs) {
        const d = doc.data();
        if ((d.ibiNumber && d.ibiNumber.toUpperCase() === idUpper) || (d.email && d.email.toLowerCase() === idLower)) {
          memberRef = doc.ref;
          break;
        }
      }
    }
    if (!memberRef) return NextResponse.json({ error: `No member found for "${id}"` }, { status: 404 });

    if (action === 'set') {
      await memberRef.update({
        pndStatus: 'active', pndReason: reason.trim(),
        pndSetBy: auth.uid, pndSetAt: new Date(),
      });
    } else {
      await memberRef.update({
        pndStatus: 'none', pndReason: null,
        pndClearedBy: auth.uid, pndClearedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, action });
  } catch (e: any) {
    console.error('[admin/pnd]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
