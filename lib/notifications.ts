// lib/notifications.ts
//
// Foundation for TD/C item: "no functional push notifications service."
// This is the IN-APP layer — a notification feed + unread counter that
// works for every member with zero setup, no browser permission prompt,
// no service worker. It's the right foundation to build first because it
// works immediately and everywhere; real OS-level push (via Firebase
// Cloud Messaging) can be layered on top later without changing this data
// model, but needs a VAPID key generated in the Firebase console — a
// manual step only Emmanuel can do, so it's intentionally not attempted
// here. See TECH_DEBT_AND_ROADMAP.md for the FCM follow-up plan.
//
// Data model: a single `notifications` collection. Each doc has an
// `audience` of 'all' (broadcast) or 'user' (targeted, via `targetUid`),
// and a `readBy` array of uids who've seen it. This keeps the model to one
// collection with no fan-out writes at broadcast time (an "all" broadcast
// is ONE document, not one per member) — the trade-off is `readBy` grows
// unbounded for old broadcasts at very large scale, which is a fine
// simplification for a v1 foundation and easy to revisit later (e.g.
// moving to a separate per-user read-cursor doc) without changing how
// this file's callers use it.
//
// Server-routed throughout — see app/api/notifications/* — deliberately
// NOT read/written directly from client Firestore SDK calls, so this
// doesn't depend on Firestore rules being deployed correctly (that gap is
// exactly what broke the pricing panel earlier this session).
import { adminDb } from '@/lib/firebase-admin';
import { getAllChapters, type RegionId } from '@/lib/chapters-data';

export interface NotificationInput {
  title: string;
  body: string;
  link?: string;
  type?: 'transaction' | 'system' | 'announcement' | 'admin';
  audience: 'all' | 'user';
  targetUid?: string; // required when audience === 'user'
  createdBy?: string; // admin uid, for admin-composed broadcasts
}

export async function createNotification(input: NotificationInput) {
  if (input.audience === 'user' && !input.targetUid) {
    throw new Error('targetUid required when audience is "user"');
  }
  await adminDb.collection('notifications').add({
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    type: input.type ?? 'system',
    audience: input.audience,
    targetUid: input.targetUid ?? null,
    createdBy: input.createdBy ?? null,
    readBy: [],
    createdAt: new Date(),
  });
}

/** Convenience wrapper for the common case: a transaction alert to one member. */
export async function notifyTransaction(uid: string, title: string, body: string, link = '/dashboard/wallet') {
  return createNotification({ title, body, link, type: 'transaction', audience: 'user', targetUid: uid });
}

/**
 * Fires an in-app bell notification to every superadmin, for the
 * highest-stakes categories in RUNBOOK.md §7 — money/reconciliation,
 * fraud, and system/webhook failures. These already send an email to
 * finance@/fraud.report@/status.report@, but inbox email is easy to miss
 * or triage late; the bell shows up the moment a superadmin is next on
 * the platform. Deliberately superadmin-only, not all admins — matches
 * the same elevated tier already used for wallet credit/debit
 * (lib/admins.ts) since these are the same category of consequential
 * action.
 *
 * There's no `audience: 'superadmin'` on the notifications data model
 * itself (see NotificationInput above) — reusing 'all' would show these
 * to every member, and there's no cheap way to filter a broadcast doc by
 * role at read time without changing /api/notifications for everyone. So
 * this fans out one targeted doc per superadmin instead. That's a
 * write-per-superadmin, not a write-per-member — cheap at any realistic
 * admin-team size.
 */
export async function notifySuperadmins(title: string, body: string, link = '/admin') {
  const snap = await adminDb.collection('admins').where('role', '==', 'superadmin').get();
  if (snap.empty) return; // no superadmins promoted yet — nothing to notify, email alert is still the fallback
  await Promise.all(
    snap.docs.map(d => createNotification({ title, body, link, type: 'admin', audience: 'user', targetUid: d.id })),
  );
}

/**
 * Fans out a notification to every member in one chapter, or every member
 * across every chapter in one region. Member docs only store `chapter`
 * (the human name, e.g. "Anambra State") — there's no stored `region`
 * field — so a region send derives the matching chapter set from
 * getAllChapters()'s `region` field first, then queries `members` by
 * chapter membership.
 *
 * This is a full-ish collection read (all members in scope), not a
 * targeted query — same trade-off already accepted elsewhere in this
 * codebase (e.g. /api/admin/members scans the whole collection). Fine for
 * an admin-triggered broadcast action, not a hot path.
 */
export async function notifyChapter(chapterName: string, title: string, body: string, link?: string) {
  const snap = await adminDb.collection('members').where('chapter', '==', chapterName).get();
  await Promise.all(
    snap.docs.map(d => createNotification({ title, body, link, type: 'announcement', audience: 'user', targetUid: d.id })),
  );
  return snap.size;
}

export async function notifyRegion(regionId: RegionId, title: string, body: string, link?: string) {
  const chapterNames = getAllChapters().filter(c => c.region === regionId).map(c => c.value);
  if (chapterNames.length === 0) return 0;

  // Firestore 'in' queries cap at 30 values — chunk if a region ever has
  // more chapters than that (Region 2 currently has 30, right at the
  // edge, so this isn't hypothetical).
  const chunks: string[][] = [];
  for (let i = 0; i < chapterNames.length; i += 30) chunks.push(chapterNames.slice(i, i + 30));

  const allDocs = (await Promise.all(
    chunks.map(chunk => adminDb.collection('members').where('chapter', 'in', chunk).get()),
  )).flatMap(s => s.docs);

  await Promise.all(
    allDocs.map(d => createNotification({ title, body, link, type: 'announcement', audience: 'user', targetUid: d.id })),
  );
  return allDocs.length;
}
