// app/api/admin/debit-wallet/route.ts
// Mirrors credit-wallet's member-lookup logic exactly, but debits instead
// of credits — for correcting erroneous credits or reversing confirmed
// fraud. Superadmin-only, same as credit. Notably: unlike a member's own
// transfer/debit, this deliberately bypasses the PND check — an admin
// correcting a restricted account's balance needs to be able to do so
// even while that account is under a PND restriction. atomicDebit's PND
// check exists to stop the MEMBER from moving money out, not to stop an
// authorized admin from fixing the ledger.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { requireSuperAdmin } from '@/lib/admins';
import { InsufficientBalanceError, MemberNotFoundError } from '@/lib/wallet';

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
    if (!note || !note.trim()) {
      return NextResponse.json({ error: 'A note explaining the debit is required for the audit trail' }, { status: 400 });
    }

    const numAmount = Number(amount);
    const id = identifier.trim();

    let memberRef: FirebaseFirestore.DocumentReference | null = null;
    let memberData: FirebaseFirestore.DocumentData | null = null;

    const directSnap = await adminDb.collection('members').doc(id).get();
    if (directSnap.exists) {
      memberRef  = directSnap.ref;
      memberData = directSnap.data()!;
    }

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

    // Admin debit bypasses the member-facing PND check (see file comment)
    // — does its own atomic transaction directly rather than going through
    // atomicDebit, which would reject a PND'd account.
    const uid = memberRef.id;
    const result = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(memberRef!);
      if (!snap.exists) throw new MemberNotFoundError(uid);
      const balance = snap.data()!.walletBalance ?? 0;
      if (balance < numAmount) throw new InsufficientBalanceError(balance, numAmount);

      const newBalance = balance - numAmount;
      t.update(memberRef!, { walletBalance: newBalance });
      t.set(adminDb.collection('transactions').doc(), {
        uid, type: 'debit', amount: numAmount,
        description: note.trim(), ref: `ADMIN-${Date.now()}`,
        balance: newBalance, adminBy: auth.uid, createdAt: new Date(),
      });
      return { newBalance };
    });

    return NextResponse.json({
      success:     true,
      displayName: memberData.displayName,
      ibiNumber:   memberData.ibiNumber ?? 'N/A',
      email:       memberData.email,
      prevBalance: memberData.walletBalance ?? 0,
      newBalance:  result.newBalance,
    });

  } catch (e: any) {
    if (e instanceof InsufficientBalanceError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof MemberNotFoundError)      return NextResponse.json({ error: e.message }, { status: 404 });
    console.error('[debit-wallet]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
