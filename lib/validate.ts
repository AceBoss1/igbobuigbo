// lib/validate.ts
//
// Shared input validation for money amounts. Request bodies are untrusted
// JSON, so `amount` can arrive as a string ("100"), NaN, Infinity or a long
// fraction. JS arithmetic quietly coerces some of those (50000 + "100" is
// the STRING "50000100"), which previously let a crafted transfer write a
// string into another member's walletBalance. Every route that moves money
// must check with isValidAmount() and lib/wallet.ts re-asserts it.

/** True only for a real finite number > 0 with at most 2 decimal places. */
export function isValidAmount(v: unknown): v is number {
  return typeof v === 'number'
    && Number.isFinite(v)
    && v > 0
    && Math.round(v * 100) / 100 === v;
}

export class InvalidAmountError extends Error {
  constructor() { super('Invalid amount'); }
}

export function assertValidAmount(v: unknown): asserts v is number {
  if (!isValidAmount(v)) throw new InvalidAmountError();
}
