// app/api/admin/set-admin/route.ts
// Bootstrap: make a user an admin by their email, optionally with a role.
// Protected by ADMIN_BOOTSTRAP_SECRET env var.
// Usage: POST { email, secret, role? }  — role: 'admin' (default) | 'superadmin'
//
// Also the way to PROMOTE an existing admin to superadmin — just re-run
// with role: 'superadmin'. Since admin docs previously had no role field
// at all, every admin defaults to 'admin' (see lib/admins.ts) until
// explicitly promoted this way — including your own account, if you were
// already an admin before this shipped.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // Tight limit — this is the single highest-stakes secret in the app
  // (guessing it grants admin access). Already gated by
  // ADMIN_BOOTSTRAP_SECRET, but a real person calling this legitimately
  // needs at most a couple of attempts; 3 per hour per IP removes any
  // realistic room for brute-forcing the secret itself.
  const limited = await rateLimitByIp(req, 'set-admin', 3, 3600);
  if (limited) return NextResponse.json(limited.body, { status: limited.status });

  const { email, secret, role } = await req.json();
  const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!bootstrapSecret || secret !== bootstrapSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
  }
  const grantedRole = role === 'superadmin' ? 'superadmin' : 'admin';

  try {
    const user = await adminAuth.getUserByEmail(email);
    await adminDb.collection('admins').doc(user.uid).set({
      uid:       user.uid,
      email,
      role:      grantedRole,
      grantedAt: new Date(),
    }, { merge: true });
    // Also set custom claim for middleware
    await adminAuth.setCustomUserClaims(user.uid, { admin: true });
    return NextResponse.json({ success: true, uid: user.uid, role: grantedRole, message: `${email} is now a${grantedRole === 'superadmin' ? ' superadmin' : 'n admin'}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
