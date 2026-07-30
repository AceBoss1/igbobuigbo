// app/api/member/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb }    from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

// Nigerian Tax ID from https://taxid.nrs.gov.ng — e.g. TXID1234ABCD001
const TAX_ID_REGEX = /^TXID[0-9]{4}[A-Z]{4}[0-9]{3}$/;

// NIN — 11 digits
const NIN_REGEX = /^\d{11}$/;

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    // ── Scalar fields ──────────────────────────────────────────────────────
    const SCALAR = [
      'displayName', 'phone', 'trade', 'state', 'lga', 'address',
      'bio', 'photoURL', 'gender', 'bloodType', 'nationality',
      'businessName', 'position',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of SCALAR) {
      if (key in body && body[key] !== undefined) updates[key] = body[key];
    }

    // ── NIN — 11 digits, validated ────────────────────────────────────────
    if ('nin' in body && body.nin) {
      const nin = String(body.nin).trim();
      if (!NIN_REGEX.test(nin))
        return NextResponse.json({ error: 'NIN must be exactly 11 digits' }, { status: 400 });
      updates['nin'] = nin;
    }

    // ── Business Tax ID — required for Nigeria-domiciled businesses ────────
    if ('businessTaxId' in body) {
      const taxId          = String(body.businessTaxId ?? '').trim().toUpperCase();
      const isNigeria      = !body.nationality || body.nationality === 'Nigeria';
      const hasBusinessName = !!body.businessName || !!(updates['businessName']);

      if (hasBusinessName && isNigeria && !taxId)
        return NextResponse.json(
          { error: 'Tax ID required for Nigeria-domiciled businesses. Get yours at https://taxid.nrs.gov.ng' },
          { status: 400 },
        );

      if (taxId && !TAX_ID_REGEX.test(taxId))
        return NextResponse.json(
          { error: 'Invalid Tax ID format. Expected: TXID1234ABCD001 (from https://taxid.nrs.gov.ng)' },
          { status: 400 },
        );

      if (taxId) updates['businessTaxId'] = taxId;
    }

    // ── Next of kin (nested object) ────────────────────────────────────────
    if (body.nextOfKin && typeof body.nextOfKin === 'object') {
      const { name, relationship, phone, email } = body.nextOfKin;
      updates['nextOfKin'] = {
        name:         String(name         ?? '').trim(),
        relationship: String(relationship ?? '').trim(),
        phone:        String(phone        ?? '').trim(),
        email:        String(email        ?? '').trim(),
      };
    }

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    await adminDb.collection('members').doc(auth.uid).update(updates);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
