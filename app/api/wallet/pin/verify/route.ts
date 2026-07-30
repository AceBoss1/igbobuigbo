// app/api/wallet/pin/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { verifyMemberPin, PinLockedError } from '@/lib/pin';
import { createPinSession } from '@/lib/pinSession';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });

    const mode = await verifyMemberPin(auth.uid, pin);
    const res = NextResponse.json({ valid: true, mode });
    await createPinSession(res, auth.uid, mode);
    return res;
  } catch (e: any) {
    if (e instanceof PinLockedError) {
      return NextResponse.json({ error: e.message, lockedUntil: e.until.toISOString() }, { status: 423 });
    }
    console.error('[wallet/pin/verify]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 400 });
  }
}
