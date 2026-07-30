// scripts/seed-dev-member.mjs
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv(filePath) {
  if (!existsSync(filePath)) return false;
  const lines = readFileSync(filePath, 'utf8').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim(); i++;
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else if ((val.startsWith('"') && !val.endsWith('"')) || (val.startsWith("'") && !val.endsWith("'"))) {
      const quote = val[0]; let collected = val.slice(1);
      while (i < lines.length) {
        const next = lines[i]; i++;
        if (next.trimEnd().endsWith(quote)) { collected += '\n' + next.trimEnd().slice(0, -1); break; }
        collected += '\n' + next;
      }
      val = collected;
    }
    if (key.includes('PRIVATE_KEY')) val = val.replace(/\\n/g, '\n');
    process.env[key] = val;
  }
  return true;
}

const loaded = loadEnv(resolve(ROOT, '.env.local')) || loadEnv(resolve(ROOT, '.env'));
if (!loaded) { console.error('✗ No .env.local found'); process.exit(1); }
console.log('✓ Loaded environment variables');

const pk = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
if (!pk?.includes('BEGIN')) { console.error('✗ FIREBASE_ADMIN_PRIVATE_KEY malformed'); process.exit(1); }
console.log(`✓ Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

if (!getApps().length) {
  initializeApp({ credential: cert({
    projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  })});
}

const auth = getAuth();
const db   = getFirestore();

const TEST_EMAIL    = 'test@igbobuigbo.org.ng';
const TEST_PASSWORD = 'TestIBI1234!';

async function seed() {
  console.log('\n🌱 Seeding dev member…\n');

  // Auth user
  let uid;
  try {
    const existing = await auth.getUserByEmail(TEST_EMAIL);
    uid = existing.uid;
    console.log(`✓ Auth user exists (${uid})`);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      const created = await auth.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD, displayName: 'Chukwuemeka Okafor', emailVerified: true });
      uid = created.uid;
      console.log(`✓ Auth user created (${uid})`);
    } else { throw e; }
  }

  // Member doc — write all fields explicitly
  const memberData = {
    uid,
    email:          TEST_EMAIL,
    displayName:    'Chukwuemeka Okafor',
    firstName:      'Chukwuemeka',
    lastName:       'Okafor',
    phone:          '08067871203',
    ibiNumber:      'LAG/3847291056',
    chapterCode:    'LAG',
    chapter:        'Lagos State',
    region:         'ig',
    membershipTier: 'professional',
    status:         'active',
    walletBalance:  25000,       // <-- stored as NUMBER not string
    affiliateCode:  'IBICHUKW7X3A',
    trade:          'Technology',
    state:          'Lagos',
    lga:            'Ikeja',
    position:       'Member',
    joinedAt:       new Date().toISOString(),
    expiresAt:      null,        // lifetime
    createdAt:      new Date(),
  };

  await db.collection('members').doc(uid).set(memberData, { merge: true });
  console.log('✓ Member doc written');

  // Verify the write
  const snap = await db.collection('members').doc(uid).get();
  const data = snap.data();
  console.log(`✓ Verified walletBalance from Firestore: ₦${data?.walletBalance ?? 'MISSING'}`);
  if (typeof data?.walletBalance !== 'number') {
    console.error('✗ walletBalance is not a number! Type:', typeof data?.walletBalance);
  }

  // Transactions
  const txCol = db.collection('transactions');
  const existingTx = await txCol.where('uid', '==', uid).limit(1).get();
  if (existingTx.empty) {
    const txs = [
      { uid, type:'credit', amount:25000, description:'Wallet Top-Up via Paystack',       ref:'IBI-WLT-SEED1', balance:25000, createdAt:new Date(Date.now()-2*86400000) },
      { uid, type:'debit',  amount:5000,  description:'IBI Professional Registration',    ref:'IBI-REG-SEED1', balance:20000, createdAt:new Date(Date.now()-86400000) },
      { uid, type:'credit', amount:1500,  description:'Affiliate Commission — Emeka Eze', ref:'IBI-AFF-SEED1', balance:21500, createdAt:new Date(Date.now()-3600000) },
    ];
    for (const tx of txs) await txCol.add(tx);
    console.log('✓ Sample transactions added');
  }

  // Affiliate stats
  const affSnap = await db.collection('affiliateStats').where('uid','==',uid).limit(1).get();
  if (affSnap.empty) {
    await db.collection('affiliateStats').add({ uid, referrals:3, earnings:4500 });
    console.log('✓ Affiliate stats added');
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ✅  Dev member seeded!                                      ║
╠══════════════════════════════════════════════════════════════╣
║  Login:     http://localhost:3000/login                      ║
║  Email:     test@igbobuigbo.org.ng                           ║
║  Password:  TestIBI1234!                                     ║
╠══════════════════════════════════════════════════════════════╣
║  IMPORTANT: Deploy Firestore rules BEFORE testing wallet:    ║
║  firebase deploy --only firestore:rules                      ║
╚══════════════════════════════════════════════════════════════╝
`);
  process.exit(0);
}

seed().catch(e => {
  const pid = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (e.code === 7 || e.message?.includes('Cloud Firestore API')) {
    console.error(`✗ Firestore not enabled.\n  Open: https://console.firebase.google.com/project/${pid}/firestore\n  Click "Create database" → production mode → europe-west1 → Enable`);
  } else if (e.code === 'auth/configuration-not-found') {
    console.error(`✗ Firebase Auth not enabled.\n  Open: https://console.firebase.google.com/project/${pid}/authentication\n  Click "Get started" → Email/Password → Enable`);
  } else {
    console.error('✗ Seed failed:', e.message ?? e);
  }
  process.exit(1);
});
