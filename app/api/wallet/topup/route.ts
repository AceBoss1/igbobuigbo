// app/api/wallet/topup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { atomicCredit, MemberNotFoundError } from '@/lib/wallet';
import { notifyTransaction } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { reference, amount } = await req.json();
    if (!amount || amount < 100) {
      return NextResponse.json({ error: 'Amount must be at least ₦100' }, { status: 400 });
    }
    if (!reference) {
      return NextResponse.json({ error: 'Payment reference required' }, { status: 400 });
    }

    // This route trusted the client-submitted `amount` outright with NO
    // verification against Paystack at all — the client-side onSuccess
    // callback (which fires this call) can be triggered directly from
    // devtools without ever paying anything. Verify the actual
    // transaction, and confirm what was actually charged matches what's
    // being credited, before crediting a single naira.
    const verified = await verifyPaystackTransaction(reference);
    if (!verified.status) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }
    if (verified.amount !== amount * 100) {
      return NextResponse.json({ error: 'Amount mismatch — verified payment does not match requested top-up' }, { status: 400 });
    }

    // Paystack's own `reference` doubles as the idempotency key here — a
    // retried topup call for the same payment (client retry, or a race
    // with the webhook safety net) resolves to the same credit, not a
    // second one, and it's all inside one atomic transaction now instead
    // of a separate dup-check-then-write with a race window between them.
    const result = await atomicCredit(auth.uid, amount, {
      description: 'Wallet Top-Up via Paystack',
      ref: reference,
      clientRequestId: reference,
    });

    if (!result.duplicate) {
      notifyTransaction(auth.uid, 'Wallet Topped Up', `₦${amount.toLocaleString()} added to your wallet.`).catch(() => {});
    }

    return NextResponse.json({ success: true, newBalance: result.newBalance, duplicate: result.duplicate });
  } catch (e: any) {
    if (e instanceof MemberNotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error('[wallet/topup]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
