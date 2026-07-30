// app/api/admin/member-lookup/route.ts
// Looks up a member (by UID, IBI number, or email) plus their card orders
// and current PND status — feeds the admin panel's Security sub-tab so an
// admin can find a member once and see everything relevant to restricting
// them in one call, rather than three.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { requireAdmin } from '@/lib/admins';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await requireAdmin(auth.uid);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

  let memberDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;

  const directSnap = await adminDb.collection('members').doc(id).get();
  if (directSnap.exists) {
    memberDoc = directSnap;
  } else {
    const allSnap = await adminDb.collection('members').limit(500).get();
    const idUpper = id.toUpperCase(), idLower = id.toLowerCase();
    memberDoc = allSnap.docs.find(d => {
      const m = d.data();
      return (m.ibiNumber && m.ibiNumber.toUpperCase() === idUpper) || (m.email && m.email.toLowerCase() === idLower);
    }) ?? null;
  }

  if (!memberDoc || !memberDoc.exists) return NextResponse.json({ error: `No member found for "${id}"` }, { status: 404 });
  const m = memberDoc.data()!;

  const cardsSnap = await adminDb.collection('cardOrders').where('uid', '==', memberDoc.id).limit(20).get();
  const cards = cardsSnap.docs.map(d => {
    const c = d.data();
    return {
      id: d.id, cardType: c.cardType, cardTier: c.cardTier, status: c.status,
      restricted: Boolean(c.restricted), restrictedReason: c.restrictedReason ?? null,
    };
  });

  return NextResponse.json({
    uid: memberDoc.id,
    displayName: m.displayName, email: m.email, ibiNumber: m.ibiNumber ?? 'N/A',
    walletBalance: m.walletBalance ?? 0,
    pndStatus: m.pndStatus ?? 'none', pndReason: m.pndReason ?? null,
    cards,
  });
}
