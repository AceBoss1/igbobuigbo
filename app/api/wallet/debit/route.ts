// app/api/wallet/debit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { atomicDebit, InsufficientBalanceError, DuressCapExceededError, MemberNotFoundError, PndRestrictedError } from '@/lib/wallet';
import { requireTransactionPin, pinErrorResponse } from '@/lib/pin';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, description, ref, clientRequestId, pin } = await req.json();
    if (!amount || amount <= 0) return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });

    let pinMode: 'main' | 'duress';
    try {
      pinMode = await requireTransactionPin(auth.uid, pin);
    } catch (e: any) {
      const { status, body } = pinErrorResponse(e);
      return NextResponse.json(body, { status });
    }

    const result = await atomicDebit(auth.uid, amount, {
      description: description ?? 'Wallet Payment',
      ref: ref ?? `DBT-${Date.now()}`,
      clientRequestId,
      mode: pinMode,
    });

    return NextResponse.json({ success: true, newBalance: result.newBalance, duplicate: result.duplicate });
  } catch (e: any) {
    if (e instanceof InsufficientBalanceError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof DuressCapExceededError)   return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof MemberNotFoundError)      return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof PndRestrictedError)      return NextResponse.json({ error: e.message }, { status: 403 });
    console.error('[wallet/debit]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
