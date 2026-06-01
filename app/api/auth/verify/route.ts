// app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token, true /* check revoked */);

    // Check if user is an admin
    const adminSnap = await adminDb.collection('admins').doc(decoded.uid).get();
    const isAdmin   = adminSnap.exists || decoded.admin === true;

    return NextResponse.json({
      uid:   decoded.uid,
      email: decoded.email ?? '',
      admin: isAdmin,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Token invalid' }, { status: 401 });
  }
}
