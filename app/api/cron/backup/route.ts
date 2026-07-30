// app/api/cron/backup/route.ts
//
// Automated daily Firestore export to Google Cloud Storage. Before this,
// there was no backup routine at all — one bad migration, a slipped admin
// action, or a bug in a money-moving route hitting live data with 43
// chapters of real members and no way back is the single worst way to
// start post-launch.
//
// Uses the Firestore Admin REST API's exportDocuments — NOT the
// firebase-admin SDK directly, since the SDK's Firestore client doesn't
// expose export/import (those are GCP-project-level operations, not
// per-document Firestore SDK calls). Authenticates by pulling an OAuth2
// access token off the SAME service account credential firebase-admin
// already uses (lib/firebase-admin.ts), so no new secrets/dependencies —
// just needs that service account to also hold the
// "Cloud Datastore Import Export Admin" IAM role in GCP (see setup note
// below) and a target GCS bucket.
//
// Configure cron-job.org (or Vercel Cron) to call:
//   URL:    https://igbobuigbo.org.ng/api/cron/backup
//   Method: GET
//   Header: x-cron-secret: {CRON_SECRET}      (same secret as birthday cron)
//   Time:   03:00 WAT (02:00 UTC) daily — low-traffic window
//
// ONE-TIME GCP SETUP (not code — do this in Google Cloud Console):
//   1. Create a GCS bucket, e.g. gs://igbobuigbo-firestore-backups
//      (same GCP project as Firestore; enable a lifecycle rule to auto-
//      delete backups older than ~30-60 days so storage cost doesn't grow
//      forever).
//   2. Grant the existing service account (FIREBASE_ADMIN_CLIENT_EMAIL)
//      the "Cloud Datastore Import Export Admin" role in IAM, and
//      "Storage Object Admin" on that bucket specifically.
//   3. Set env vars: BACKUP_GCS_BUCKET=igbobuigbo-firestore-backups,
//      CRON_SECRET already exists from the birthday cron.
//
// RESTORE (when actually needed): `gcloud firestore import
// gs://igbobuigbo-firestore-backups/{export-folder}` — restores into the
// SAME project. This overwrites live data, so it's a break-glass action,
// not something to automate; documented here so it isn't tribal knowledge
// locked in one person's head.
import { NextRequest, NextResponse } from 'next/server';
import { getApps } from 'firebase-admin/app';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmailSmart as sendEmail } from '@/lib/emailRouter';
import { notifySuperadmins } from '@/lib/notifications';

// The firebase-admin Credential interface (what cert() returns, in
// lib/firebase-admin.ts) exposes getAccessToken() — this pulls a
// short-lived OAuth2 token off the SAME service account already
// configured for adminDb/adminAuth, rather than parsing the private key
// ourselves or adding google-auth-library as a new dependency.
async function getAccessToken(): Promise<string> {
  // adminDb's exports are lazy Proxies (see lib/firebase-admin.ts) — the
  // underlying app is only initialized on first property access, not on
  // import. Touching .collection forces that init before getApps() below
  // reads the singleton.
  void adminDb.collection;
  const app = getApps()[0];
  if (!app) throw new Error('Firebase Admin app not initialized');
  const { access_token } = await app.options.credential!.getAccessToken();
  return access_token;
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bucket = process.env.BACKUP_GCS_BUCKET;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!bucket || !projectId) {
    console.error('[cron/backup] BACKUP_GCS_BUCKET or FIREBASE_ADMIN_PROJECT_ID not configured');
    return NextResponse.json({ error: 'Backup not configured — see setup note in route source' }, { status: 500 });
  }

  const dateStamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const outputUriPrefix = `gs://${bucket}/${dateStamp}`;

  try {
    const accessToken = await getAccessToken();

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):exportDocuments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        // No collectionIds specified = exports the entire database.
        body: JSON.stringify({ outputUriPrefix }),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message ?? `Export request failed (${res.status})`);
    }

    // The export runs as a long-running GCP operation — this response
    // confirms it STARTED, not that it finished. Firestore exports of a
    // database this size typically complete in minutes; there's no cheap
    // way to poll completion from here without adding a second cron tick,
    // so this alerts on start-failure only. A silently-failed export after
    // a successful start would only surface by checking the bucket, which
    // is an acceptable gap for a v1 of this — the ops runbook should note
    // "spot-check the bucket weekly."
    console.log('[cron/backup] export started:', data.name);

    return NextResponse.json({ success: true, operation: data.name, outputUriPrefix });
  } catch (e: any) {
    console.error('[cron/backup] failed:', e.message);

    try {
      await sendEmail({
        to: process.env.STATUS_ALERT_EMAIL ?? 'status.report@igbobuigbo.org.ng',
        subject: '🚨 IBI: Firestore backup FAILED',
        html: `<p>The scheduled Firestore export failed to start.</p><p>Error: ${e.message}</p><p>Check BACKUP_GCS_BUCKET, FIREBASE_ADMIN_PROJECT_ID, and that the service account has the "Cloud Datastore Import Export Admin" IAM role.</p>`,
      });
    } catch { /* if even the alert email fails, the cron log is the last resort */ }

    await notifySuperadmins(
      '🚨 Firestore backup failed',
      `Scheduled export failed to start: ${e.message}. Check BACKUP_GCS_BUCKET / IAM role.`,
    ).catch(() => {});

    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
