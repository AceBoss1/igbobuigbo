// lib/firebase-admin.ts
// SERVER-SIDE ONLY. Never import in 'use client' files.
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let _app: App | null = null;
let _db:   Firestore | null = null;
let _auth: Auth | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length) { _app = getApps()[0]; return _app; }

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[firebase-admin] Missing env vars.\n' +
      'Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,\n' +
      'and FIREBASE_ADMIN_PRIVATE_KEY in .env.local'
    );
  }

  _app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return _app;
}

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop: string) {
    if (!_db) _db = getFirestore(getAdminApp());
    const val = (_db as any)[prop];
    return typeof val === 'function' ? val.bind(_db) : val;
  },
});

export const adminAuth = new Proxy({} as Auth, {
  get(_, prop: string) {
    if (!_auth) _auth = getAuth(getAdminApp());
    const val = (_auth as any)[prop];
    return typeof val === 'function' ? val.bind(_auth) : val;
  },
});
