// lib/pin.ts
//
// PIN storage/verification for wallet transactions (C-01). Uses Node's
// built-in crypto.scrypt rather than adding bcryptjs as a new dependency
// — scrypt is a well-regarded, memory-hard KDF built into Node since v10,
// zero extra install needed.
//
// Important honesty about what hashing does and doesn't buy here: a
// 4-digit PIN has only 10,000 possible values. No hash algorithm makes
// that keyspace bigger. What scrypt + a random salt actually defends
// against is an attacker who steals the database and tries to precompute
// or rainbow-table their way through every account's hash at once — it
// does NOT meaningfully slow down someone guessing a SINGLE account's
// PIN interactively. That defense is rate-limiting, enforced in
// app/api/wallet/pin/verify/route.ts (5 attempts, then a cooldown), not
// here. Both matter; neither is sufficient alone.
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';

const SCRYPT_KEYLEN = 64;

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN);
  const expected  = Buffer.from(hash, 'hex');
  // Length check first — timingSafeEqual throws on mismatched lengths
  // rather than returning false, and a thrown error here would leak
  // timing information of its own.
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES  = 15;

export class PinLockedError extends Error {
  constructor(public until: Date) {
    super(`Too many incorrect PIN attempts. Try again after ${until.toLocaleTimeString()}.`);
  }
}

// Distinguishes "you haven't set one up" from "you typed it wrong" — these
// need very different UI responses (a link to set up a PIN vs. a retry
// prompt), and without this every pre-PIN-system member would just see
// "Incorrect PIN" forever with no way to actually proceed, which looks
// indistinguishable from the whole PIN requirement being broken.
export class PinNotSetError extends Error {
  constructor() { super('You have not set up a wallet PIN yet. Go to Profile → Wallet PIN & Security to set one up, then try again.'); }
}

// Every request field the client can only skip by editing its own script,
// so it must never be trusted client-side — it's here so every
// money-moving API route can require and verify a PIN.
export class PinRequiredError extends Error {
  constructor() { super('PIN required'); }
}

/**
 * Every money-moving route calls this with the raw `pin` field straight off
 * the request body, EVERY request — there is deliberately no "already
 * unlocked this session" shortcut here. A client-side unlock (PinGateModal)
 * only ever gated the wallet PAGE's UI; it was never enforced by the API
 * routes themselves, so a direct/replayed request could skip PIN entry
 * entirely. This is the fix: the pin is re-verified fresh, server-side, on
 * every single transaction, no matter what the client believes its session
 * state is.
 */
export async function requireTransactionPin(uid: string, pin: unknown): Promise<'main' | 'duress'> {
  if (typeof pin !== 'string' || !isValidPinFormat(pin)) throw new PinRequiredError();
  return verifyMemberPin(uid, pin);
}

/** Maps the PIN errors above to the right HTTP status for a route to return. */
export function pinErrorResponse(e: any): { status: number; body: { error: string; code?: string; lockedUntil?: string } } {
  if (e instanceof PinRequiredError) return { status: 400, body: { error: e.message } };
  if (e instanceof PinNotSetError)   return { status: 409, body: { error: e.message, code: 'PIN_NOT_SET' } };
  if (e instanceof PinLockedError)   return { status: 423, body: { error: e.message, lockedUntil: e.until.toISOString() } };
  return { status: 401, body: { error: e.message ?? 'Incorrect PIN' } };
}

// A duress-PIN member's transactions are capped to a small fraction of
// their REAL balance, so a coerced "send it all" demand can't actually
// move much — while every response involved stays generically worded
// ("Insufficient wallet balance") so nothing about the amount, the cap,
// or duress mode itself leaks back to whoever is standing over their
// shoulder. lib/wallet.ts imports this divisor to enforce the cap
// atomically, inside the same Firestore transaction as the balance read.
export const DURESS_CAP_DIVISOR = 100;

/**
 * Verifies a PIN attempt against a member's stored main/duress hashes,
 * with rate-limiting. Returns which PIN matched, or throws.
 */
export async function verifyMemberPin(uid: string, pin: string): Promise<'main' | 'duress'> {
  const memberRef  = adminDb.collection('members').doc(uid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) throw new Error('Member not found');
  const m = memberSnap.data()!;

  if (!m.pinHash) throw new PinNotSetError();

  if (m.pinLockedUntil && m.pinLockedUntil.toDate() > new Date()) {
    throw new PinLockedError(m.pinLockedUntil.toDate());
  }

  const mainMatch   = m.pinHash  && verifyPinHash(pin, m.pinHash);
  const duressMatch = m.pin2Hash && verifyPinHash(pin, m.pin2Hash);

  if (!mainMatch && !duressMatch) {
    const attempts = (m.pinFailCount ?? 0) + 1;
    const update: Record<string, any> = { pinFailCount: attempts };
    if (attempts >= MAX_PIN_ATTEMPTS) {
      const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      update.pinLockedUntil = until;
      update.pinFailCount   = 0;
      await memberRef.update(update);
      throw new PinLockedError(until);
    }
    await memberRef.update(update);
    throw new Error(`Incorrect PIN (${MAX_PIN_ATTEMPTS - attempts} attempts remaining before a ${LOCKOUT_MINUTES}-minute lock).`);
  }

  // Correct PIN — clear any failure count/lock.
  if ((m.pinFailCount ?? 0) > 0 || m.pinLockedUntil) {
    await memberRef.update({ pinFailCount: 0, pinLockedUntil: null });
  }

  return mainMatch ? 'main' : 'duress';
}
