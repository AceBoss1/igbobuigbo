// lib/paystack.ts
export class PaystackVerificationError extends Error {}

export async function verifyPaystackTransaction(reference: string) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    // Fail fast with an unambiguous message rather than letting the
    // request go out with `Authorization: Bearer ` (nothing after it) and
    // relying on Paystack's own generic "Format is Authorization: Bearer
    // [secret key]" response to imply the real problem, which is: this
    // env var isn't set in whatever environment is actually running this
    // code right now. Common causes: not added to Vercel at all, added to
    // the wrong environment scope (Production vs Preview vs Development),
    // or added but not redeployed since (Vercel only picks up new env
    // vars on a fresh deployment, not on already-running ones).
    throw new PaystackVerificationError('PAYSTACK_SECRET_KEY is not set in this environment — check Vercel project settings and redeploy if it was just added.');
  }

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });

  // Read as text first — an error response (bad reference, rate limit,
  // wrong secret key for this environment) can come back with an empty or
  // non-JSON body, and res.json() throws its own opaque parse error on
  // that. Parsing text ourselves lets us produce one clear, catchable
  // error message either way instead of two different crash shapes.
  const raw = await res.text();
  let data: any;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new PaystackVerificationError(`Paystack returned a non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok || data.status !== true || !data.data) {
    // data.status is Paystack's own top-level "did the API call itself
    // succeed" flag — distinct from data.data.status, which is "did the
    // TRANSACTION succeed" (a card can be validly declined; that's not an
    // API failure). Missing data.data here is exactly what previously
    // caused callers to crash on `payment.status` — undefined has no
    // .status property. Throwing here instead means the donate route's
    // own try/catch (or any other caller's) surfaces this real message.
    throw new PaystackVerificationError(data.message ?? `Paystack verification failed (HTTP ${res.status})`);
  }

  return data.data as { status: boolean; amount: number; currency: string; metadata: Record<string, unknown> };
}

export async function initiatePaystackTransfer(params: {
  amount: number;         // kobo
  recipient: string;      // Paystack transfer recipient code
  reason: string;
  reference: string;
}) {
  const res = await fetch('https://api.paystack.co/transfer', {
    method:  'POST',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source:    'balance',
      amount:    params.amount,
      recipient: params.recipient,
      reason:    params.reason,
      reference: params.reference,
    }),
  });
  return res.json();
}
