// lib/paystack.ts
export async function verifyPaystackTransaction(reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const data = await res.json();
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
