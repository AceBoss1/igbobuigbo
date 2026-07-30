// lib/firebase.ts
// CLIENT-SIDE ONLY. Guards against server-side initialization.
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

let _app:  FirebaseApp | null = null;
let _auth: Auth       | null = null;
let _db:   Firestore  | null = null;

function initFirebase() {
  if (typeof window === 'undefined') return; // never run on server

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.warn('[firebase] NEXT_PUBLIC_FIREBASE_API_KEY not set — client SDK inactive');
    return;
  }

  if (!getApps().length) {
    _app = initializeApp({
      apiKey,
      authDomain:            process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId:             process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket:         process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId:     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId:                 process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

    // Use persistent cache with long-polling to avoid WebSocket CORS blocks
    try {
      _db = initializeFirestore(_app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        // experimentalForceLongPolling forces REST-style polling
        // instead of WebSocket — fixes the CORS error you're seeing
        experimentalForceLongPolling: true,
      });
    } catch {
      // Fallback if persistentLocalCache not available (Safari/incognito)
      _db = getFirestore(_app);
    }

  } else {
    _app = getApps()[0];
    _db  = getFirestore(_app);
  }

  _auth = getAuth(_app);
}

// Run immediately on module load (client only)
if (typeof window !== 'undefined') {
  initFirebase();
}

export { _auth as auth, _db as db, _app as app };
