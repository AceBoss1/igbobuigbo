# IBI Platform — Incident Runbook

Procedures for the incidents most likely to actually happen in week one.
This is written for whoever's on call — not necessarily the developer —
so each entry gives the exact place to look and the exact action to take,
not general troubleshooting advice.

Every reference (`TRF-...`, `IBI-CHTRF-...`, `IBI-STMT-...`, etc.) can be
looked up at **igbobuigbo.org.ng/verify** without needing Firebase
console access — start there for any "what happened to my transaction"
report.

---

## 1. "I was double-charged"

**Where to look first:** `/verify` with the reference the member gives
you, or the `transactions` collection in Firestore filtered by their
`uid`.

**What's already protecting against this:**
- Every money-moving route (`wallet/debit`, `wallet/transfer`,
  `cards/order`, `membership/upgrade`, `donate`) uses `clientRequestId` /
  `ref` as an idempotency key inside `lib/wallet.ts`'s atomic Firestore
  transactions — a retried request with the same key is a no-op, not a
  second debit.
- The Paystack webhook (`app/api/webhooks/paystack/route.ts`) checks for
  an existing recorded transaction FIRST and no-ops if found, before ever
  completing an action itself. It's a safety net, not a second charge
  path.

**So a genuine double-charge is rare, but if you find two distinct
transaction docs for what should be one action:**
1. Confirm both are real distinct Firestore docs (not just the member
   seeing a slow UI update and thinking it happened twice).
2. Check `ref` on both — if they're genuinely different references for
   the same intended action, someone bypassed idempotency (report this
   as a bug, don't just refund and move on).
3. Refund path: use **Admin Panel → Credit Wallet** (superadmin required)
   to credit the member back the duplicate amount. Log the reason —
   `adminLogs` records every credit automatically.
4. Alert **`finance@igbobuigbo.org.ng`** with both refs either way, for
   the balance-drift reconciliation record.

---

## 2. "I'm locked out of my wallet PIN"

**Where to look:** `members/{uid}` doc — check `pinLockedUntil` and
`pinFailCount`.

**This is expected behavior, not a bug** — 5 wrong attempts triggers a
15-minute lock (`lib/pin.ts`, `MAX_PIN_ATTEMPTS` / `LOCKOUT_MINUTES`).
Nothing needs fixing; tell the member to wait, or:

**If it's genuinely urgent (member needs a transaction to go through
now):** an admin can manually clear the lock —
```
members/{uid}.update({ pinFailCount: 0, pinLockedUntil: null })
```
Do this only after verifying the member's identity through another
channel (phone call to the number on file, not just the email they're
messaging from) — clearing a lock is exactly the kind of thing a scammer
impersonating a member would ask for.

**If the member says they don't remember setting a PIN at all:** they
likely registered before the PIN system existed and never got prompted.
Direct them to **Profile → Wallet PIN & Security** to set one — this
shows automatically instead of the old "Incorrect PIN" loop
(`PinNotSetError` in `lib/pin.ts`).

**Never** reset or reveal a PIN value directly — there is no way to do
this even by admin, by design; `pinHash`/`pin2Hash` are one-way hashes.
The only admin action is clearing the *lockout*, not the PIN itself.

---

## 3. "My transfer/debit didn't go through but my balance dropped"

**Where to look:** the specific `ref` at `/verify`, and `adminLogs` for
anything matching the `uid` around that timestamp.

This should be structurally impossible — `atomicDebit`/`atomicTransfer`
(`lib/wallet.ts`) do the balance check and the decrement inside the SAME
Firestore transaction. If you find a case where it genuinely happened:
1. Screenshot/export the transaction doc and the member doc's
   `walletBalance` history if available.
2. This is a **stop-and-escalate** case, not a refund-and-move-on case —
   it means the atomicity guarantee broke somewhere, which is a
   code-level bug that needs the developer, not just a balance fix.
3. Credit the member back in the meantime via Admin Panel (superadmin),
   and flag to `finance@igbobuigbo.org.ng` with full details.

---

## 4. Chapter transfer application stuck / not showing for admin

**Where to look:** Admin Panel → **Chapter Transfers** tab (pending
count badge). If the member has a `IBI-CHTRF-...` ref that doesn't
resolve at `/verify`, or doesn't appear in that tab, check the `transfers`
collection directly for a doc with that `ref` — if it exists but the tab
is empty, that's a `status` field problem (should be `'pending'`); if the
doc doesn't exist at all, the original submission failed and the member
needs to reapply.

Approve/reject from that tab — this updates the member's `chapter` /
`chapterCode` (their IBI Number is untouched), and fires an email + SMS +
in-app bell notification automatically. No manual notification needed.

---

## 5. Firestore backup / restore

Daily automated export to GCS — see `app/api/cron/backup/route.ts` for
full setup notes and the exact `gcloud firestore import` restore command.

**Restoring is destructive** (overwrites live data) — this is a
break-glass action requiring the developer, not a routine support step.
If you ever think you need this, stop, don't touch anything further, and
escalate immediately rather than trying more fixes that could make a
restore harder to land cleanly.

**Weekly check:** spot-check the GCS bucket has a recent dated folder.
The cron alerts on export *start* failure by email, not completion — a
silently-stalled export wouldn't otherwise be caught until someone needed
it.

---

## 6. Suspected fraud / account compromise

Alert **`fraud.report@igbobuigbo.org.ng`** immediately.

If a member reports their account was accessed by someone else:
1. Do NOT just reset their PIN lock or take their word for identity over
   the same channel that might be compromised (e.g. an email that could
   be the attacker). Verify via phone call to the number on file.
2. Once verified, an admin can trigger **card restriction**
   (`api/admin/cards/restrict`) and/or a **PND** (Post-No-Debit,
   `api/admin/pnd`) on the wallet — both are regular-admin actions, no
   need to wait for superadmin.
3. Advise the member to change their Firebase Auth password
   (Profile → Security, or a password reset email) — a compromised PIN
   without a compromised login is a much smaller problem than both.

---

## 7. General escalation

- **Money/balance issues, refunds, reconciliation:**
  `finance@igbobuigbo.org.ng`
- **Fraud, compromised accounts, suspicious activity:**
  `fraud.report@igbobuigbo.org.ng`
- **System errors, failed crons, webhook failures:**
  `status.report@igbobuigbo.org.ng`

When in doubt about whether something is a support fix or a code bug:
if it required editing a Firestore document by hand to resolve, it's
worth flagging to the developer even after you've resolved it — a
support-side fix today can be the same underlying bug for the next ten
members tomorrow.
