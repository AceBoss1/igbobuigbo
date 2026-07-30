// lib/wallet.ts
//
// Every wallet-money-movement route (debit, topup, transfer) previously
// read a balance, checked it in application code, then wrote a new balance
// in a SEPARATE step — classic time-of-check-to-time-of-use (TOCTOU) race.
// Under concurrent requests (a script firing many transfers at once, or
// just two legitimate taps on a slow connection), every request can read
// the SAME starting balance, each independently pass the "sufficient
// funds" check against that same stale number, and each write back
// balance-minus-amount — meaning far more money leaves an account than it
// ever actually held, while every recipient still gets credited in full.
// That's a real double-spend bug, not a theoretical one.
//
// Firestore's runTransaction() closes this: reads inside a transaction are
// tracked, and if any read document changes before the transaction
// commits, Firestore automatically retries the whole transaction with a
// fresh read. Concurrent requests against the same account are correctly
// serialized — only as many can succeed as the real balance supports.
//
// This also gives us idempotency for free: a network drop after the user
// enters their PIN (common on Nigerian mobile networks) means the client
// can't tell if the request succeeded. If it retries with the SAME
// clientRequestId, we recognize that and return the original result
// instead of processing a second time — no double debit, no confusing
// warning needed for the automatic-retry case.
import { adminDb } from '@/lib/firebase-admin';
import type { Transaction } from 'firebase-admin/firestore';
import { DURESS_CAP_DIVISOR } from '@/lib/pin';

export class InsufficientBalanceError extends Error {
  constructor(public balance: number, public requested: number) {
    super(`Insufficient wallet balance. Have ₦${balance.toLocaleString()}, need ₦${requested.toLocaleString()}`);
  }
}
export class MemberNotFoundError extends Error {
  constructor(uid: string) { super(`Member not found: ${uid}`); }
}
export class PndRestrictedError extends Error {
  constructor() { super('This wallet is temporarily restricted. Please contact support.'); }
}
// Deliberately generic message (no real balance, no cap, no mention of
// "duress") — this is what a duress-mode member sees when a transaction
// exceeds their cap, and it must look identical to an ordinary
// insufficient-balance error to whoever might be watching them enter it.
export class DuressCapExceededError extends Error {
  constructor() { super('Insufficient wallet balance'); }
}

/** Throws DuressCapExceededError if `amount` exceeds the duress cap for `realBalance`. No-op for mode 'main'/undefined. */
function enforceDuressCap(mode: 'main' | 'duress' | undefined, realBalance: number, amount: number) {
  if (mode !== 'duress') return;
  const cap = Math.floor(realBalance / DURESS_CAP_DIVISOR);
  if (amount > cap) throw new DuressCapExceededError();
}

interface TxMeta {
  description: string;
  ref: string;
  clientRequestId?: string | null;
  extra?: Record<string, any>;
  /** Extra fields to merge into the member doc's update, in the SAME transaction as the debit (e.g. membershipTier on an upgrade). */
  memberExtra?: Record<string, any>;
  /** Result of a fresh verifyMemberPin() call for THIS request — enforces the duress cap atomically against the real balance just read. Omit only for non-PIN-gated flows (e.g. inbound credits). */
  mode?: 'main' | 'duress';
}

/** Looks up an existing transaction by clientRequestId, INSIDE a transaction read. */
async function findDuplicate(t: Transaction, uid: string, clientRequestId?: string | null) {
  if (!clientRequestId) return null;
  const q = adminDb.collection('transactions')
    .where('uid', '==', uid)
    .where('clientRequestId', '==', clientRequestId)
    .limit(1);
  const snap = await t.get(q);
  return snap.empty ? null : snap.docs[0].data();
}

/** Atomically debits a single member's wallet. Throws InsufficientBalanceError / MemberNotFoundError. */
export async function atomicDebit(uid: string, amount: number, meta: TxMeta) {
  const memberRef = adminDb.collection('members').doc(uid);

  return adminDb.runTransaction(async (t) => {
    const dup = await findDuplicate(t, uid, meta.clientRequestId);
    if (dup) return { newBalance: dup.balance as number, duplicate: true };

    const snap = await t.get(memberRef);
    if (!snap.exists) throw new MemberNotFoundError(uid);
    const data = snap.data()!;
    if (data.pndStatus === 'active') throw new PndRestrictedError();
    const balance = data.walletBalance ?? 0;
    if (balance < amount) throw new InsufficientBalanceError(balance, amount);
    enforceDuressCap(meta.mode, balance, amount);

    const newBalance = balance - amount;
    t.update(memberRef, { walletBalance: newBalance, ...meta.memberExtra });
    t.set(adminDb.collection('transactions').doc(), {
      uid, type: 'debit', amount,
      description: meta.description, ref: meta.ref,
      clientRequestId: meta.clientRequestId ?? null,
      balance: newBalance, createdAt: new Date(),
      ...meta.extra,
    });
    return { newBalance, duplicate: false };
  });
}

/** Atomically credits a single member's wallet. Throws MemberNotFoundError. */
export async function atomicCredit(uid: string, amount: number, meta: TxMeta) {
  const memberRef = adminDb.collection('members').doc(uid);

  return adminDb.runTransaction(async (t) => {
    const dup = await findDuplicate(t, uid, meta.clientRequestId);
    if (dup) return { newBalance: dup.balance as number, duplicate: true };

    const snap = await t.get(memberRef);
    if (!snap.exists) throw new MemberNotFoundError(uid);
    const balance = snap.data()!.walletBalance ?? 0;
    const newBalance = balance + amount;

    t.update(memberRef, { walletBalance: newBalance });
    t.set(adminDb.collection('transactions').doc(), {
      uid, type: 'credit', amount,
      description: meta.description, ref: meta.ref,
      clientRequestId: meta.clientRequestId ?? null,
      balance: newBalance, createdAt: new Date(),
      ...meta.extra,
    });
    return { newBalance, duplicate: false };
  });
}

/**
 * Atomically moves money between two members in a SINGLE transaction —
 * both the debit and credit happen together or not at all, so there's no
 * window where a sender is debited but a recipient never gets credited
 * (or vice versa) under concurrent load.
 */
export async function atomicTransfer(
  senderUid: string, recipientUid: string, amount: number,
  meta: { ref: string; clientRequestId?: string | null; senderDescription: string; recipientDescription: string; mode?: 'main' | 'duress' },
) {
  const senderRef    = adminDb.collection('members').doc(senderUid);
  const recipientRef = adminDb.collection('members').doc(recipientUid);

  return adminDb.runTransaction(async (t) => {
    const dup = await findDuplicate(t, senderUid, meta.clientRequestId);
    if (dup) return { senderNewBalance: dup.balance as number, recipientNewBalance: null as number | null, duplicate: true };

    // Firestore transactions require ALL reads before any writes.
    const [senderSnap, recipientSnap] = await Promise.all([t.get(senderRef), t.get(recipientRef)]);
    if (!senderSnap.exists)    throw new MemberNotFoundError(senderUid);
    if (!recipientSnap.exists) throw new MemberNotFoundError(recipientUid);

    const senderData = senderSnap.data()!;
    if (senderData.pndStatus === 'active') throw new PndRestrictedError(); // sender-side only — a restricted member can still RECEIVE money
    const senderBalance = senderData.walletBalance ?? 0;
    if (senderBalance < amount) throw new InsufficientBalanceError(senderBalance, amount);
    enforceDuressCap(meta.mode, senderBalance, amount);
    const recipientBalance = recipientSnap.data()!.walletBalance ?? 0;

    const senderNew    = senderBalance - amount;
    const recipientNew = recipientBalance + amount;

    t.update(senderRef,    { walletBalance: senderNew });
    t.update(recipientRef, { walletBalance: recipientNew });

    t.set(adminDb.collection('transactions').doc(), {
      uid: senderUid, type: 'debit', amount,
      description: meta.senderDescription, ref: meta.ref,
      clientRequestId: meta.clientRequestId ?? null,
      balance: senderNew, createdAt: new Date(),
    });
    t.set(adminDb.collection('transactions').doc(), {
      uid: recipientUid, type: 'credit', amount,
      description: meta.recipientDescription, ref: meta.ref,
      balance: recipientNew, createdAt: new Date(),
    });

    return { senderNewBalance: senderNew, recipientNewBalance: recipientNew, duplicate: false };
  });
}
