// app/api/admin/whoami/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { getAdminRole } from '@/lib/admins';

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = await getAdminRole(auth.uid);
  if (!role) return NextResponse.json({ error: 'Not an admin' }, { status: 403 });

  return NextResponse.json({ role });
}
