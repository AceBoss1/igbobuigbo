// app/api/admin/credit-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { requireSuperAdmin } from '@/lib/admins';
import { atomicCredit, MemberNotFoundError } from '@/lib/wallet';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      await requireSuperAdmin(auth.uid);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

    const { identifier, amount, note } = body;
    if (!identifier || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'identifier and amount (> 0) required' }, { status: 400 });
    }

    const numAmount = Number(amount);
    const id = identifier.trim();

    // Strategy: try UID first (exact doc lookup — always works, no index)
    let memberRef: FirebaseFirestore.DocumentReference | null = null;
    let memberData: FirebaseFirestore.DocumentData | null = null;

    // 1. Try as direct Firestore UID
    const directSnap = await adminDb.collection('members').doc(id).get();
    if (directSnap.exists) {
      memberRef  = directSnap.ref;
      memberData = directSnap.data()!;
    }

    // 2. Not a UID — scan all members (no composite index needed, just a full collection read)
    if (!memberRef) {
      const allSnap = await adminDb.collection('members').limit(500).get();
      const idUpper  = id.toUpperCase();
      const idLower  = id.toLowerCase();

      for (const doc of allSnap.docs) {
        const d = doc.data();
        if (
          (d.ibiNumber  && d.ibiNumber.toUpperCase()  === idUpper) ||
          (d.email      && d.email.toLowerCase()       === idLower) ||
          (d.phone      && d.phone.replace(/\s/g,'')   === id.replace(/\s/g,''))
        ) {
          memberRef  = doc.ref;
          memberData = d;
          break;
        }
      }
    }

    if (!memberRef || !memberData) {
      return NextResponse.json({
        error: `No member found for "${id}". Try their Firestore UID, IBI number (e.g. LAG/3847291056), or email address.`
      }, { status: 404 });
    }

    const prevBalance = typeof memberData.walletBalance === 'number' ? memberData.walletBalance : 0;

    let result;
    try {
      result = await atomicCredit(memberRef.id, numAmount, {
        description: note?.trim() || 'Admin wallet credit',
        ref: `ADMIN-${Date.now()}`,
        extra: { adminBy: auth.uid },
      });
    } catch (e: any) {
      if (e instanceof MemberNotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
      throw e;
    }

    return NextResponse.json({
      success:     true,
      displayName: memberData.displayName,
      ibiNumber:   memberData.ibiNumber ?? 'N/A',
      email:       memberData.email,
      prevBalance,
      newBalance:  result.newBalance,
    });

  } catch (e: any) {
    console.error('[credit-wallet]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
