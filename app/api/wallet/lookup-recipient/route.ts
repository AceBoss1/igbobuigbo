// app/api/wallet/lookup-recipient/route.ts
// PUBLIC-safe: returns only display name + photo for the transfer confirmation UI.
// Never returns uid, email, phone, balance, or any sensitive field.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb }                   from '@/lib/firebase-admin';
import { verifyAuth }                from '@/lib/auth-middleware';

// IBI number pattern — e.g. OTH/8263354454  or  ANA/3847291056
const IBI_PATTERN = /^[A-Z]{2,8}\/\d{10}$/;

export async function GET(req: NextRequest) {
  // Require auth so random internet traffic can't enumerate member names
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ibi = req.nextUrl.searchParams.get('ibi')?.trim().toUpperCase() ?? '';

  if (!IBI_PATTERN.test(ibi)) {
    return NextResponse.json(
      { error: 'Invalid IBI number format. Expected: CHAPTER/10DIGITS e.g. ANA/3847291056' },
      { status: 400 },
    );
  }

  // Prevent self-transfer
  if (ibi === auth.ibiNumber) {
    return NextResponse.json(
      { error: 'You cannot transfer to yourself' },
      { status: 400 },
    );
  }

  try {
    const snap = await adminDb
      .collection('members')
      .where('ibiNumber', '==', ibi)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { error: `No IBI member found with number ${ibi}` },
        { status: 404 },
      );
    }

    const d = snap.docs[0].data();

    // Only return safe public fields
    return NextResponse.json({
      found:      true,
      name:       d.displayName   ?? 'IBI Member',
      ibiNumber:  d.ibiNumber,
      chapter:    d.chapter       ?? '',
      status:     d.status        ?? 'active',
      photoURL:   d.photoURL      ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Lookup failed. Please try again.' }, { status: 500 });
  }
}
