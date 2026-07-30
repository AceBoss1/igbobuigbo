// app/api/wallet/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';
import { atomicTransfer, InsufficientBalanceError, DuressCapExceededError, MemberNotFoundError, PndRestrictedError } from '@/lib/wallet';
import { notifyTransaction } from '@/lib/notifications';
import { requireTransactionPin, pinErrorResponse } from '@/lib/pin';

// Accept "LAG/3847291056" OR just "3847291056" — strip chapter prefix
function normaliseIBI(input: string): { full: string; digits: string } {
  const s       = input.trim().toUpperCase();
  const digits  = s.includes('/') ? s.split('/')[1] : s;
  return { full: s, digits };
}

// ── GET: look up recipient info for confirmation prompt ──────────────────────
export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('ibi');
  if (!id) return NextResponse.json({ error: 'ibi param required' }, { status: 400 });

  const { full, digits } = normaliseIBI(id);
  const snap = await adminDb.collection('members').limit(500).get();
  const doc  = snap.docs.find(d => {
    const m = d.data();
    if (!m.ibiNumber) return false;
    const mDigits = m.ibiNumber.includes('/') ? m.ibiNumber.split('/')[1] : m.ibiNumber;
    return m.ibiNumber.toUpperCase() === full || mDigits === digits;
  });

  if (!doc) return NextResponse.json({ error: `No member found for "${id}"` }, { status: 404 });
  const m = doc.data();
  return NextResponse.json({ displayName: m.displayName, ibiNumber: m.ibiNumber, chapter: m.chapter });
}

// ── POST: execute transfer ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipientIbiNumber, amount, note, clientRequestId, confirmDuplicate, pin } = await req.json();
    if (!recipientIbiNumber || !amount || amount < 100) {
      return NextResponse.json({ error: 'recipientIbiNumber and amount (min ₦100) required' }, { status: 400 });
    }

    // PIN is verified fresh on EVERY transfer — no "already unlocked this
    // session" shortcut. This also tells us main vs duress for the cap
    // check below, straight from this request's own PIN attempt rather
    // than a client-asserted session state.
    let pinMode: 'main' | 'duress';
    try {
      pinMode = await requireTransactionPin(auth.uid, pin);
    } catch (e: any) {
      const { status, body } = pinErrorResponse(e);
      return NextResponse.json(body, { status });
    }

    // Find recipient — accept with or without chapter prefix
    const { full, digits } = normaliseIBI(recipientIbiNumber);
    const allSnap  = await adminDb.collection('members').limit(500).get();
    const recDoc   = allSnap.docs.find(d => {
      const m = d.data();
      if (!m.ibiNumber) return false;
      const mDigits = m.ibiNumber.includes('/') ? m.ibiNumber.split('/')[1] : m.ibiNumber;
      return m.ibiNumber.toUpperCase() === full || mDigits === digits;
    });

    if (!recDoc) return NextResponse.json({ error: `No member found for "${recipientIbiNumber}"` }, { status: 404 });
    if (recDoc.id === auth.uid) return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 });

    const recipient = recDoc.data();

    // Sender's display info, for the transaction description text only —
    // deliberately NOT part of the atomic balance operation below, since a
    // microsecond-stale display name in a description string is harmless,
    // unlike a stale balance.
    const senderSnap = await adminDb.collection('members').doc(auth.uid).get();
    if (!senderSnap.exists) return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    const sender = senderSnap.data()!;

    // Duress cap (if pinMode === 'duress') is enforced atomically inside
    // atomicTransfer, against the balance read in that same transaction —
    // see lib/wallet.ts. Doing it here instead would re-introduce a TOCTOU
    // gap between this read and the actual debit.


    // Nigerian mobile networks drop mid-transaction often enough that this
    // needs explicit handling: a member enters their PIN, the network dies
    // before the success response arrives, they never see the toast, and
    // — reasonably — they try again. If that retry reuses the SAME
    // clientRequestId (an automatic client-side retry of the exact same
    // attempt), atomicTransfer's idempotency check below returns the
    // original result safely, no warning needed. But if it's a genuinely
    // NEW submission (fresh clientRequestId) that happens to match a
    // transfer to the same recipient for the same amount in the last few
    // minutes, we can't tell if that's a deliberate second transfer or the
    // user manually retrying after not seeing confirmation — so we ask,
    // rather than silently doing either.
    if (!confirmDuplicate) {
      const recentCutoff = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes
      const recentSnap = await adminDb.collection('transactions')
        .where('uid', '==', auth.uid)
        .where('type', '==', 'debit')
        .limit(20)
        .get();
      const possibleDup = recentSnap.docs
        .map(d => d.data())
        .find(tx =>
          tx.amount === amount &&
          tx.createdAt?.toDate?.() > recentCutoff &&
          typeof tx.description === 'string' && tx.description.includes(recipient.ibiNumber)
        );
      if (possibleDup) {
        return NextResponse.json({
          warning: 'possible_duplicate',
          message: `You already sent ₦${amount.toLocaleString()} to ${recipient.displayName} (${recipient.ibiNumber}) a moment ago. Send another ₦${amount.toLocaleString()} to the same recipient?`,
          recipientName: recipient.displayName,
          recipientIBI: recipient.ibiNumber,
        }, { status: 409 });
      }
    }

    const ref = `TRF-${Date.now().toString(36).toUpperCase()}`;
    const result = await atomicTransfer(auth.uid, recDoc.id, amount, {
      ref,
      clientRequestId,
      senderDescription:    `Transfer to ${recipient.displayName} (${recipient.ibiNumber})`,
      recipientDescription: `Transfer from ${sender.displayName} (${sender.ibiNumber})${note ? ` — ${note}` : ''}`,
      mode: pinMode,
    });

    if (!result.duplicate) {
      // Transaction alerts — fire-and-forget, never block the transfer response on these.
      notifyTransaction(auth.uid, 'Transfer Sent',
        `₦${amount.toLocaleString()} sent to ${recipient.displayName} (${recipient.ibiNumber}).`).catch(() => {});
      notifyTransaction(recDoc.id, 'Money Received',
        `₦${amount.toLocaleString()} received from ${sender.displayName}${note ? ` — "${note}"` : ''}.`).catch(() => {});
    }

    return NextResponse.json({
      success:       true, ref, reference: ref, // both keys — app/dashboard/wallet/page.tsx reads json.reference, this was a pre-existing mismatch (see the blank "Reference No." on generated receipts)
      duplicate:     result.duplicate,
      recipientName: recipient.displayName,
      recipientIBI:  recipient.ibiNumber,
      newBalance:    result.senderNewBalance,
    });
  } catch (e: any) {
    if (e instanceof InsufficientBalanceError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof DuressCapExceededError)   return NextResponse.json({ error: e.message }, { status: 400 }); // same generic message/status as InsufficientBalanceError — deliberately indistinguishable
    if (e instanceof MemberNotFoundError)      return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof PndRestrictedError)      return NextResponse.json({ error: e.message }, { status: 403 });
    console.error('[wallet/transfer]', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
