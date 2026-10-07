// app/api/affiliate/withdraw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { requireTransactionPin, pinErrorResponse } from '@/lib/pin';

const MIN_WITHDRAWAL = 500;

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // The client-supplied amount is deliberately NOT read. It used to be
    // credited as-is (any value >= 500), which let a member mint wallet
    // money. The payable amount is computed here from the member's own
    // 'pending' referrals, and the payout + marking them paid happen in one
    // Firestore transaction so the same commission can never be paid twice.
    const { pin } = await req.json();

    // This moves commission into the member's own wallet rather than out
    // of it, but it's still a PIN-gated money-moving action per policy —
    // required fresh, every time, same as debit/transfer.
    try {
      await requireTransactionPin(auth.uid, pin);
    } catch (e: any) {
      const { status, body } = pinErrorResponse(e);
      return NextResponse.json(body, { status });
    }

    const memberRef = adminDb.collection('members').doc(auth.uid);
    const pendingQuery = adminDb.collection('referrals')
      .where('referrerUid', '==', auth.uid)
      .where('status', '==', 'pending');
    const ref = `AFF-PAY-${Date.now()}`;

    const result = await adminDb.runTransaction(async (t) => {
      const [memberSnap, pendingSnap] = await Promise.all([t.get(memberRef), t.get(pendingQuery)]);
      if (!memberSnap.exists) return { error: 'Member not found', status: 404 as const };

      const amount = pendingSnap.docs.reduce((sum, d) => {
        const c = d.data().commission;
        return sum + (typeof c === 'number' && Number.isFinite(c) && c > 0 ? c : 0);
      }, 0);
      if (amount < MIN_WITHDRAWAL) {
        return { error: `Minimum withdrawal is ₦${MIN_WITHDRAWAL}`, status: 400 as const };
      }

      const current    = memberSnap.data()!.walletBalance;
      const newBalance = (typeof current === 'number' ? current : 0) + amount;

      t.update(memberRef, { walletBalance: newBalance });
      pendingSnap.docs.forEach(d => t.update(d.ref, { status: 'paid', paidAt: new Date(), paidRef: ref }));
      t.set(adminDb.collection('transactions').doc(), {
        uid: auth.uid, type: 'credit', amount,
        description: 'Affiliate Commission Payout',
        ref, balance: newBalance, createdAt: new Date(),
      });
      return { newBalance, amount };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { newBalance } = result;

    return NextResponse.json({ success: true, newBalance });
  } catch (e: any) {
    console.error('[affiliate/withdraw]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
