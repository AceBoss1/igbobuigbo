// app/api/member/me/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);

  if (!auth.ok) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const snap = await adminDb
    .collection('members')
    .doc(auth.uid)
    .get();

  if (!snap.exists) {
    return NextResponse.json(
      { error: 'Member not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    uid: snap.id,
    ...snap.data(),
  });
}