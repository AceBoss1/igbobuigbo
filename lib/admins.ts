// lib/admins.ts
// Admin role checking. `admins/{uid}` docs previously had no role concept
// — being in the collection at all meant full admin access, including
// crediting wallets directly. Per Emmanuel's decision, wallet
// credit/debit is now superadmin-only; everything else (approvals, PND,
// card restrictions, notifications) stays regular-admin.
//
// IMPORTANT MIGRATION NOTE: existing admin docs have no `role` field.
// getAdminRole() treats a missing role as 'admin', NOT 'superadmin' — the
// safe default. This means any admin who could previously credit wallets
// will lose that ability the moment this ships, until explicitly promoted
// (re-run /api/admin/set-admin with role: 'superadmin' for their account).
// This is deliberate — defaulting the other way would be a privilege
// escalation nobody asked for.
import { adminDb } from '@/lib/firebase-admin';

export type AdminRole = 'admin' | 'superadmin' | null;

export async function getAdminRole(uid: string): Promise<AdminRole> {
  const snap = await adminDb.collection('admins').doc(uid).get();
  if (!snap.exists) return null;
  const role = snap.data()?.role;
  return role === 'superadmin' ? 'superadmin' : 'admin'; // missing/unrecognised role -> 'admin', never auto-superadmin
}

export async function requireAdmin(uid: string): Promise<AdminRole> {
  const role = await getAdminRole(uid);
  if (!role) throw new Error('Admin access required');
  return role;
}

export async function requireSuperAdmin(uid: string): Promise<void> {
  const role = await getAdminRole(uid);
  if (role !== 'superadmin') throw new Error('Superadmin access required for this action');
}
