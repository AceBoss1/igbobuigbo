# IBI Member Portal — Tech Debt Report & Build Roadmap
*Prepared by Adams Consults · June 2026 · Last major update: July 2026*

---

## PART A — KNOWN TECH DEBT

### 🔴 Critical (affects correctness or money)

#### ✅ TD-01 · Donation page has no wallet payment path — RESOLVED (this session)
**Was:** The donate page used `DualPayment` which never actually debited the
wallet at all for `method === 'wallet'` — donations were recorded with
nothing deducted, and separately, callers were multiplying amounts by 100
before passing them to `DualPayment` (which takes Naira, not kobo — see
corrected TD-09 below), so any donation that *did* attempt to charge would
have billed 100x. Both bugs compounded: on the Paystack path the 100x
error caused real overcharges; on the wallet path, no charge occurred at all.

**Fix:** `/api/donate/route.ts` now debits the wallet atomically server-side
for `method === 'wallet'` (auth required, single Firestore batch: debit +
`transactions` record + `donations` record + cause total), generating the
dedicated `IBI-DON-WLT-{timestamp}` reference per PREFIXES.md §2. Both
`app/donate/page.tsx` and the new `components/dashboard/DonateModal.tsx`
now make a single call to `/api/donate` with `method` + a client-generated
`clientRef` for idempotency — no separate `/api/wallet/debit` call, mirroring
the pattern `/api/cards/order` already used correctly.

---

#### ✅ TD-02 · Card double-billing root cause still fragile — RESOLVED
**Was:** `DualPayment` used to call `/api/wallet/debit` itself AND the
consuming API (`/api/cards/order`) also debited, risking double billing or
silent no-billing depending on which lookup succeeded first.

**Fix (already in place, confirmed this session):** `DualPayment.handleWallet()`
now only validates client-side balance and calls `onSuccess('wallet')` —
seen in the component's own comment. The consuming API
(`/api/cards/order`) does the single atomic server-side debit. This is the
exact pattern TD-01's donate fix now also follows.

---

#### ✅ TD-03 · No server-side Paystack webhook — RESOLVED (this session)
**Was:** All Paystack payment confirmations relied on the client-side
`onSuccess` callback. If the browser tab closed after paying but before the
callback fired, the action (registration, upgrade, card order) was never
completed even though money was taken. Investigating this also surfaced a
worse, related bug: `/api/wallet/topup` had **zero** server-side payment
verification at all — it trusted the client-submitted amount outright,
which could be triggered directly from devtools without paying anything.

**Fix:** `app/api/webhooks/paystack/route.ts` verifies the
`x-paystack-signature` header (HMAC SHA512 against `PAYSTACK_SECRET_KEY`,
no new secret needed), routes by reference prefix per PREFIXES.md, and
acts only as a safety net — it checks whether the primary route already
recorded the reference first, and only completes the action itself if
not. Registration (`IBI-REG-`) is deliberately NOT auto-completed (no
password available to create the Firebase Auth user); instead it emails
`finance@igbobuigbo.org.ng` to flag a paid registration that looks stuck.

**Also fixed as part of this:**
- `/api/wallet/topup` now calls `verifyPaystackTransaction` and checks the
  amount matches before crediting anything (previously trusted the client
  outright — the single worst gap found this session).
- `/api/membership/upgrade`, `/api/cards/order`, and `/api/donate` verified
  `status` but never checked the *amount* — a real Paystack reference for
  ₦100 could be replayed against a ₦2,500,000 tier. All three now check
  `verified.amount` matches the expected price (Diaspora exempted pending
  B-03, no NGN-equivalent price exists for it yet).

See the deploy guide's "Paystack Webhook" step for registering the webhook
URL in the Paystack dashboard.

---

#### ✅ TD-17 · `wallet/topup` had zero server-side payment verification — RESOLVED (this session)
**A free-money exploit, not just a billing error** (see TD-18 below for an even
larger related finding). `/api/wallet/topup` credited the
wallet using the client-submitted `amount` with **no verification against
Paystack at all**. The route it calls is triggered from Paystack's
client-side `onSuccess` callback, which can be invoked directly from
browser devtools — meaning anyone could top up their wallet for any
amount without ever paying anything.

Found while building the TD-03 webhook (auditing every Paystack call site
for what the webhook would need to safety-net turned up that this one had
no primary verification to safety-net in the first place).

**Fix:** Added `verifyPaystackTransaction(reference)` + an exact
amount-match check (`verified.amount !== amount * 100` → reject) + an
idempotency check against `transactions.ref`, before crediting anything.
Matches the same verification pattern now used consistently across
upgrade, cards/order, and donate (see TD-03 and TD-09).

---

#### ✅ TD-18 · Every wallet money-movement route had a double-spend race condition — RESOLVED (this session)
**The single most severe finding across this entire engagement — a real,
exploitable double-spend bug, not a theoretical one.** Every route that
moved wallet money (`wallet/transfer`, `wallet/debit`, `wallet/topup`, and
the wallet-payment branches inside `donate`, `cards/order`, and
`membership/upgrade`) followed the same pattern: read the current balance,
check it in application code, then write a new balance as a **separate**
step. Under concurrent requests — a script firing many transfers at once,
or just two legitimate taps on a slow connection — every request can read
the SAME starting balance, each independently pass the "sufficient funds"
check against that same stale number, and each write back
balance-minus-amount. Far more money can leave an account than it ever
held, while every recipient still gets credited in full.

Emmanuel described the exact failure mode precisely: *"account balance is
₦50,000 and each of 200 concurrent logins wants to transfer ₦45,000 — how
does the system handle it in reality?"* Answer, before this fix:
**catastrophically badly** — up to 200 × ₦45,000 could be credited out to
recipients while the sender's own balance only reflects whichever single
request's read-then-write happened to commit last.

Some routes (`donate`, `cards/order`, `membership/upgrade`) used
`FieldValue.increment()` for the actual decrement, which IS atomic at the
database level — but the insufficient-balance *check* still happened
before it as a separate step, so the exploit just manifested differently
there: balances could go negative instead of the wrong number of
transfers silently succeeding. Same root cause, same severity.

**Fix:** Built `lib/wallet.ts` — `atomicDebit`, `atomicCredit`, and
`atomicTransfer`, all using Firestore's `runTransaction()`. Reads inside a
transaction are tracked; if any read document changes before the
transaction commits, Firestore automatically retries the whole
transaction with a fresh read. Concurrent requests against the same
account are correctly serialized — only as many can succeed as the real
balance actually supports. `atomicTransfer` reads and writes both the
sender's and recipient's documents in one transaction, so there's no
window where one side updates without the other. All six routes above
were retrofitted to use these instead of their own ad-hoc read-check-write
logic.

**Also fixed as part of this — idempotency and the "flaky network" scenario.**
Emmanuel raised a second, related real-world case: on Nigerian mobile
networks, a member can enter their transfer PIN, have the network drop
before the success response arrives, never see the confirmation toast, and
reasonably try again — risking a genuine double transfer if handled
naively. Two distinct mechanisms now handle this correctly:
- **Automatic retry (same request):** the client can send a stable
  `clientRequestId` with each submission. If a request with that same ID
  already succeeded, `atomicDebit`/`atomicCredit`/`atomicTransfer` return
  the *original* result instead of processing again — silent, correct, no
  scary dialog needed, because it really is the same request.
- **Deliberate resubmission (new request, looks like a repeat):**
  `wallet/transfer` separately checks whether a *different* recent debit
  (last 3 minutes) to the same recipient for the same amount exists. If
  so, it returns a `409` with `warning: 'possible_duplicate'` and a
  ready-to-show message instead of silently sending or silently blocking —
  the client is expected to show a confirmation prompt and resubmit with
  `confirmDuplicate: true` if the member confirms they do want to send
  again. **Client-side wiring for this confirmation dialog is not done yet**
  — the server-side detection and response shape are ready; the wallet
  transfer form (`app/dashboard/wallet/page.tsx`) needs a small addition to
  show the prompt and handle the confirm/cancel flow. See B-35 below.

---

#### TD-04 · `IBI-UPG-{timestamp}` not provisioned for Paystack verify
**Problem:** When Paystack calls `onSuccess`, our server calls
`verifyPaystackTransaction(reference)`. This failed with a JSON.parse error
(now fixed in `lib/paystack.ts`) — but the underlying issue is the
`PAYSTACK_SECRET_KEY` must be set in production `.env`. Verify this is
deployed to Vercel/hosting environment variables.

**Status:** Still developing on localhost, deploying soon — this is a
deployment-time checklist item, not a code fix. Already covered in the
deploy guide's Step 2 (Env Variables) and Step 7 (Paystack Webhook, which
uses the same key for signature verification — nothing additional to
generate). Leaving this open until confirmed set in the live environment.

---

#### ✅ TD-05 · Wallet transfer API route may be missing — CORRECTED, and worse than feared
**Was flagged as:** possibly missing entirely (404 risk).

**Actual finding:** the route exists (`app/api/wallet/transfer/route.ts`) — confirmed by Emmanuel
uploading it directly — but it had something more serious than a missing route: a genuine,
exploitable double-spend race condition. See **TD-18** below for the full finding and fix; this
entry is superseded by that one.

---

### 🟡 Important (UX or data quality issues)

#### ✅ TD-06 · Firestore composite indexes not deployed — RESOLVED (this session)
**Was:** Several queries combine `where()` + `orderBy()` which require
composite indexes, worked around by removing `orderBy` and sorting in JS.

**Fix:** Added to `firestore.indexes.json` (deploy with `firebase deploy
--only firestore:indexes`):
- `events` on `(active ASC, date DESC)` — homepage upcoming events
- `news` on `(published ASC, createdAt DESC)` — homepage news feed
- `cardOrders` on `(uid ASC, createdAt DESC)`
- `transactions` on `(uid ASC, createdAt DESC)`
- `memberUpgrades` on `(uid ASC, createdAt DESC)`

Note: `affiliateStats` on `(uid)` doesn't actually need a composite index —
that's a single-field equality lookup, which Firestore auto-indexes by
default with no manual definition required. Multi-equality `where().where()`
queries (no `orderBy`) also don't need one — Firestore handles those
natively. Only equality + `orderBy` on a *different* field genuinely
requires a composite index; that's what's listed above.

---

#### TD-07 · Member photos blocked by Edge Tracking Prevention
**Problem:** Microsoft Edge's Tracking Prevention flags `res.cloudinary.com`
as a known tracker and blocks storage access for image URLs from the
`ibi/member/` Cloudinary folder.

**Fix needed:** Switch member avatar `<img>` tags to Next.js `<Image>` component.
With `res.cloudinary.com` in `next.config.js remotePatterns`, Next.js proxies
images through your own domain — Edge sees them as first-party and doesn't block.
Already configured in `next.config.js` — just needs component update.

---

#### TD-08 · `transaction.balance` field missing on old records
**Problem:** Old wallet transactions don't have a `balance` field (running balance
after the transaction). The wallet history UI shows "Bal: ₦undefined" for these.

**Fix needed:** Either a one-time migration script that back-fills the balance
field, or a defensive display (`bal !== undefined && ...`).

---

#### ✅ TD-09 · `DualPayment` amount prop ambiguity — RESOLVED, and this note was itself the bug
**This entry was wrong and caused a real production bug.** It said "DualPayment
expects kobo," but `components/DualPayment.tsx` was refactored at some point
to accept **NAIRA** (see its own type comment: `amount: number; // in NAIRA
(not kobo)` — it converts to kobo internally when calling Paystack). Anyone
(human or AI) reading this stale note and "fixing" a caller to multiply by
100 before passing `amount` to `DualPayment` was reintroducing a 100x
overcharge bug. That's exactly what happened in `app/donate/page.tsx` and
`app/dashboard/cards/page.tsx` — both were found and fixed this session.

**Correct, current contract:** `DualPayment`'s `amount` prop is always
**Naira**. Do not multiply by 100 before passing it in.

**Audited this session — confirmed correct (Naira, no ×100):**
- `app/donate/page.tsx`
- `app/dashboard/cards/page.tsx`
- `components/dashboard/DonateModal.tsx` (new)

Note: `openPaystack()` (used directly in `app/membership/page.tsx` and
`components/dashboard/UpgradeTierModal.tsx`, NOT through `DualPayment`) is a
*different* function with a *different*, legitimately kobo-based contract —
its callers correctly still multiply by 100. Don't conflate the two when
auditing.

---

#### TD-10 · `StatementReport` uses `(member as any).uid`
**Problem:** `uid` is declared in `IBIMember` interface but the cast
`(member as any).uid` suggests it may not always be populated in the
auth context, or the type wasn't updated across the codebase.

**Fix needed:** Verify `IBIMember.uid` is consistently populated by
`AuthContext` from Firebase Auth, and remove the `as any` cast.

---

#### TD-11 · Registration page still redirects to `/membership` for upgrade
**Problem:** The `UpgradeTierModal` is wired into the dashboard overview
and dashboard layout, but the public `/membership` page may still show
"Upgrade" links that send logged-in users to the registration flow instead
of the dashboard modal.

---

#### ✅ TD-12 · No email verification step after registration — RESOLVED (this session)
**Was:** New members completed registration and got an account, but there
was no email verification step.

**Fix:** `lib/emailVerification.ts` generates a Firebase Admin
`generateEmailVerificationLink()` and sends it via Brevo in IBI's own
branding (not Firebase's generic template), fired automatically from
`/api/membership/register`. `components/dashboard/VerifyEmailBanner.tsx`
shows a small, non-blocking banner with a resend button for anyone still
unverified (`app/api/auth/resend-verification`) — deliberately a soft
nudge, not a hard block, so it doesn't lock out members who registered
before this existed.

---

### 🟢 Minor / Code Quality

#### TD-13 · `FlipBook` uses `react-pageflip` with no type declarations
Added `types/react-pageflip.d.ts` workaround. Should be tracked in case the
library is abandoned — consider replacing with a native CSS flip animation.

#### TD-14 · `jsPDF` cannot render ₦ symbol or emoji
Worked around with "NGN " prefix and "[SECURED]" text. Not a bug, but
limits branding in PDFs. Future fix: embed a custom font via `addFileToVFS`.

#### TD-15 · `openPaystack` dynamically imported everywhere
`await import('@/lib/paystack-inline')` is repeated in 5+ components.
Should be extracted into a single pre-initialized module or hook.

#### TD-16 · `getAllChapters()` called repeatedly without memoisation
Every time region is computed from chapter, `getAllChapters()` loops the
full chapters array. Should be memoised or converted to a lookup map.

---

## PART B — WHAT TO BUILD NEXT

### Sprint 1 — Immediate Completions (Queued)

| # | Feature | Priority | Notes |
|---|---------|----------|-------|
| B-01 | **Affiliate page: Clicks & Conversions counter** | HIGH | Display `affiliateStats.clicks`, `conversions` from Firestore |
| B-02 | **Overview: Conversion Rate metric** | HIGH | `(conversions / clicks * 100).toFixed(1)%` stat card |
| B-03 | **Admin USD exchange rate** | HIGH | `open.er-api.com/v6/latest/USD` · admin sets buy/sell markup · stored in `settings/exchangeRate` Firestore doc |
| B-04 | **USD card ordering (Visa/Mastercard)** | HIGH | Depends on B-03. Show live NGN equivalent, enable DualPayment |
| B-05 | ✅ **Donation wallet payment path** | DONE | Fixed TD-01 this session · `IBI-DON-WLT-` prefix · `/api/donate` wallet handler |
| B-06 | ✅ **Paystack webhook handler** | DONE | Fixed TD-03 · `/api/webhooks/paystack` · sig verification · prefix routing · also fixed wallet/topup's missing verification and amount-match checks on upgrade/cards/donate |

---

### Sprint 2 — Admin Dashboard

| # | Feature | Priority |
|---|---------|----------|
| B-07 | Member management (list, search, approve, suspend) | HIGH |
| B-08 | Transaction ledger with export to CSV/Excel | HIGH |
| B-09 | Admin credit / debit wallet tool (generates `ADMIN-` references) | HIGH |
| B-10 | Admin USD exchange rate settings UI | HIGH |
| B-11 | Card order status management (pending → processing → shipped → delivered) | MEDIUM |
| B-12 | Donation records and reporting dashboard | MEDIUM |
| B-13 | Affiliate commission management (approve, payout) | MEDIUM |
| B-14 | Chapter and region management | LOW |

---

### Sprint 3 — Fintech Infrastructure

| # | Feature | Priority |
|---|---------|----------|
| B-15 | **Save2Pay instalment plans** — 3/6/12 months at 10/15/20% premium, 10% platform commission | HIGH |
| B-16 | **Escrow marketplace** — 5% fee, 24-hour auto-release | HIGH |
| B-17 | **3-balance wallet** — settled / pending / total | MEDIUM |
| B-18 | Wallet transfer fee (admin-configurable, stored in Firestore settings) | MEDIUM |
| B-19 | GTBank / AXA partnership model integration | LOW |
| B-20 | Sudo Africa (BaaS) card issuance API for physical cards | LOW |

---

### Sprint 4 — Logistics & Communications

| # | Feature | Priority |
|---|---------|----------|
| B-21 | Parcel tracking (`IBI-WYB-`) — create shipment, update status | MEDIUM |
| B-22 | In-app notifications (Firestore `notifications` collection + realtime listener) | MEDIUM |
| B-23 | WhatsApp OTP login option (via Termii) | MEDIUM |
| B-24 | Member directory (opt-in, public-facing search by chapter/name) | LOW |
| B-25 | News / blog admin interface | LOW |
| B-26 | Job board (post + apply) | LOW |

---

### Sprint 5 — Quality & Infrastructure

| # | Feature | Priority |
|---|---------|----------|
| B-27 | ✅ Firestore composite indexes (fix TD-06) | DONE |
| B-28 | ✅ Paystack webhook (fix TD-03) | DONE |
| B-29 | ✅ Email verification on registration (fix TD-12) | DONE |
| B-30 | Next.js Image for Cloudinary avatars (fix TD-07) | MEDIUM |
| B-31 | Back-fill `balance` field on old transactions (fix TD-08) | MEDIUM |
| B-32 | jsPDF custom font (₦ symbol support) | LOW |
| B-33 | ✅ DualPayment `amount` audit across all pages (fix TD-09) | DONE |
| B-34 | Unit tests for billing flows (wallet debit, card order, upgrade) | MEDIUM |

---

## PART C — PRE-MASS-REGISTRATION LAUNCH GATE

Everything below is a **gap identified specifically as a blocker (or should-fix) before opening
registration to the general public at scale**, as opposed to general tech debt. Items C-01
through C-08 came directly from Emmanuel; C-09 onward are additions flagged during this session.
Two items (C-11, C-12) were fixed same-session as identified. Nothing else in this section is
built yet — these are scoped and ready to build, not started.

### 🔴 Must-fix before mass registration

#### ✅ C-01 · No PIN/2FA on wallet transfers and payments — MAIN + DURESS PIN BUILT (this session)
**Was:** Wallet transfers and in-platform payments required only being logged in — no additional
confirmation step.

**Original spec included a third "flex" PIN — deliberately NOT built.** Emmanuel's initial
design had three PINs: main (normal), duress/anti-kidnap (shows and caps at 1% of real balance,
for protection under coercion), and "flex" (displays 100x real balance, transactions still
capped at real balance). The duress PIN is a legitimate, well-precedented security pattern —
duress codes exist in ATM systems and alarm systems for exactly this reason — and was built. The
flex PIN was flagged as a concern rather than built: a balance display specifically designed to
make someone believe they have money they don't is the same mechanism used in proof-of-funds
scams and advance-fee fraud. Since IBI's own transaction descriptions would have shown real
payments as "premium VIP" amounts, this could function as platform-facilitated fabricated
evidence of wealth to a third party. Emmanuel agreed to drop it entirely — confirmed explicitly
this session.

**Architecture, resolved through direct back-and-forth this session (getting this wrong once
already cost a rebuild of the wrong shape of "confirmation"):**
- PIN entry happens **once per session**, the first time a member opens Wallet or Overview —
  not at login, not per-transaction. Balance shows masked (`••••.••`) until entered.
- The wallet-transfer review modal (built earlier this session, before PIN existed) is **kept
  alongside** PIN, not replaced by it — review the transfer details first, then the session-level
  PIN gate (already unlocked earlier in the session) applies.
- Duress-mode enforcement is **entirely server-side** (`lib/pinSession.ts` — an httpOnly cookie
  backed by a Firestore `pinSessions` record) specifically because a client-supplied "I'm in
  duress mode" flag would let anyone forcing the PIN out of a member simply edit the request to
  claim main mode and bypass the whole protection. The client-side mode
  (`lib/pinSessionClient.ts`, sessionStorage) is display-only and never trusted for enforcement.

**Built:** `lib/pin.ts` (scrypt hashing — Node's built-in crypto, no new dependency — plus
rate-limiting: 5 wrong attempts locks PIN entry for 15 minutes, since a 4-digit PIN's 10,000-value
keyspace means hashing algorithm choice alone doesn't meaningfully slow down an interactive
guesser; rate-limiting is the part that actually matters), `lib/pinSession.ts` (server-side
duress-session tracking), `lib/pinSessionClient.ts` (display-only client state),
`components/dashboard/PinGateModal.tsx` (session-entry gate — handles first-time setup and
subsequent verification), `app/api/wallet/pin/{set,set-duress,verify,status}/route.ts`. Wired into
`app/dashboard/wallet/page.tsx` and `app/dashboard/overview/page.tsx` (masked balance + gate) and
`app/api/wallet/transfer/route.ts` (server-enforced duress cap at real-balance/100). Settings UI
for changing the main PIN and setting up the duress PIN lives in `app/dashboard/profile/page.tsx`
— deliberately the *only* place both PINs are manageable together, so a PIN change made from the
wallet page itself only ever touches whichever PIN unlocked that specific session, never revealing
that a second PIN exists to whoever happens to be present at the time.

**Still open — the auto-lifted PND idea:** Emmanuel's original spec had overdraft attempts under
duress trigger a PND requiring NIN/document resubmission that silently auto-lifts on the next
deposit, without the documents actually being checked. Flagged as a concern (creates a paper
trail suggesting KYC enforcement happened when it didn't — a real compliance risk given C-05
already tracks "not KYC-ready" as an open gap) but not yet resolved either way — Emmanuel's
"drop PIN3 totally" reply addressed the flex-PIN question specifically, not this one. **Currently,
duress-mode overdraft attempts are simply rejected** ("Insufficient wallet balance," deliberately
generic so it doesn't reveal duress mode is active) with no PND or document-request flow built
yet — that part of the original spec needs a follow-up decision before it's built either way.

#### C-02 · No admin-side kill switches for compromised accounts (PND — Post No Debit)
**Gap:** If a member's account, card, or wallet is compromised, there's currently no way for an
admin to selectively disable just the affected feature — only full account suspension exists
implicitly through the `admins` collection pattern, not a granular per-member control panel.

**Needed:** Admin controls to independently disable, per member: a specific issued card, 2FA
(force re-enrollment), or wallet usage entirely via a **PND (Post No Debit) restriction** —
the standard Nigerian banking industry term for this exact mechanism, used instead of a generic
"wallet disabled" label so it reads correctly to anyone with banking-sector familiarity. While a
PND restriction is active, the member should still see their balance (never hide the number)
alongside a clear info card explaining their funds are safe and why the temporary restriction is
in place — reassurance, not silence. Suggested schema: `pndStatus: 'none' | 'active'` +
`pndReason` + `pndSetBy` + `pndSetAt` on the member doc, checked by `atomicDebit`/`atomicTransfer`
(both already centralized in `lib/wallet.ts` — this is now a single-point change, not a
per-route one, thanks to TD-18's consolidation).

#### C-03 · Any admin can credit AND debit wallets — needs a superadmin tier
**Gap:** The `admins` collection is currently flat — being in it grants full admin capability,
including `/api/admin/credit-wallet`. There's no debit route at all yet, and no distinction
between "admin" (day-to-day: approvals, member management) and "superadmin" (financial:
crediting/debiting wallets directly).

**Needed:**
- Add a `role: 'admin' | 'superadmin'` field to `admins/{uid}` documents.
- Restrict `/api/admin/credit-wallet` to `role === 'superadmin'` only.
- Build `/api/admin/debit-wallet` (doesn't exist yet) — same restriction, for correcting
  erroneous credits or reversing confirmed fraud, with mandatory admin note + reference logged
  same as credits already are.
- Every credit/debit must keep the existing `adminBy: auth.uid` audit trail (already present on
  credit-wallet) — extend the same to debit.

#### C-04 · Reconciliation job — now defense-in-depth, not the primary fix (root cause closed by TD-18)
**Gap, as originally scoped:** money moves through several independent paths (client callback,
webhook safety net, admin manual credit/debit), and nothing periodically verified the *overall*
ledger stayed consistent.

**Important update:** the specific failure mode this was meant to catch — Emmanuel's exact
question, *"200 concurrent transfer requests each seeing the same ₦50,000 balance, each trying
to send ₦45,000 — how does the system actually handle it?"* — was a live, exploitable race
condition, not just a monitoring gap. **TD-18 (above) fixes the root cause**: every
money-movement route now uses a Firestore atomic transaction (`lib/wallet.ts`), so that exact
scenario is now handled correctly at the database level — only as many of the 200 concurrent
transfers succeed as the real balance actually supports, full stop, no reconciliation job
required to catch it after the fact.

**What's still needed, as genuine defense-in-depth (not a substitute for TD-18):** a scheduled
job (Vercel Cron, same pattern as the existing birthday cron) that periodically recomputes each
active member's balance from their transaction history and flags any drift from the stored
`walletBalance` — this catches categories of bugs atomic transactions *don't* cover, like a
future code change that writes to `walletBalance` outside `lib/wallet.ts` entirely, or a manual
Firestore console edit. Also flag any transaction reference that appears more than once, as a
second, independent signal. Alert **`finance@igbobuigbo.org.ng`** for balance drift and
**`fraud.report@igbobuigbo.org.ng`** for duplicate-reference findings specifically (distinct
inboxes so financial drift and suspected fraud don't get triaged as the same kind of problem) —
mirroring the pattern already used for stuck-registration and webhook-failure alerts.

#### C-05 · Not KYC-ready
**Gap:** No identity verification exists today, and no architectural hook exists for one either.
This is explicitly called out to members as "not yet" in the FAQ/Terms pages added this session,
which is honest for now — but needs a real integration point before it becomes a compliance gap
at scale, particularly given the platform's wallet and transfer features.

**Needed:** A `kycStatus: 'none' | 'pending' | 'verified' | 'rejected'` field on the member
record, a pluggable verification-partner interface (so swapping providers later doesn't mean
rearchitecting), and a way to gate specific actions (e.g. large transfers, wallet top-ups above
a threshold) on `kycStatus === 'verified'` once a partner is selected. Building the hook now,
even before a partner is chosen, means flipping it on later doesn't require new plumbing.

### 🟡 Should-fix before mass registration

#### C-06 · No rate limiting on auth or payment endpoints
**Gap:** Login, password reset, registration, and wallet endpoints have no rate limiting. At
mass-registration scale this becomes a real brute-force and abuse surface (credential stuffing,
automated fake registrations to farm affiliate commissions on free tiers, reference-guessing
against payment-verification endpoints).

**Needed:** Rate limiting (by IP and/or account) on `/api/auth/*`, `/api/membership/register`,
and wallet-affecting routes. Vercel Edge Config or a simple Firestore-backed token bucket would
both work without adding new infrastructure.

#### C-07 · No centralized admin audit log
**Gap:** Individual admin actions record *some* trail (credit-wallet logs `adminBy` on the
transaction; approve-member doesn't currently record which admin approved). There's no single
place to review "what did admins do" as a chronological, filterable log.

**Needed:** An `adminAuditLog` collection written to by every admin-privileged route
(credit/debit, approve, pricing change, member disable/enable), with a simple admin-panel view
over it. Directly useful for investigating any C-04 reconciliation flags.

#### C-08 · Duplicate/fraudulent registration prevention
**Gap:** Nothing currently stops one person from registering multiple free (Student/Youth)
accounts, or a paid account referred by a self-controlled second account, to farm affiliate
commissions or multiply voting weight. Given real money (affiliate commission) and real
governance (voting rights) are tied to member identity, this is a fraud surface worth closing
before scale makes it profitable to automate.

**Needed:** Email duplicate-checking already exists (`app/api/membership/register` rejects a
repeat email) — phone number is not currently checked the same way, so one person can still
register multiple free accounts using different emails but the same phone. Add a phone-based
duplicate check alongside the existing email one, plus a fraud-review flag on referral pairs
that share a device fingerprint, IP, or suspiciously-timed registration pattern. This connects
directly to KYC (C-05) as the eventual real fix.

#### C-09 · No monitoring/alerting beyond a few hand-built email alerts
**Gap:** Errors mostly go to `console.log`, which nobody is watching in production. This session
added a few specific `finance@` email alerts (webhook processing failures, stuck registrations)
as point fixes, but there's no general error monitoring — a broad class of failures (e.g. a
Firestore write silently failing outside a payment path) would currently go unnoticed entirely.

**Needed:** A monitoring service (Sentry has a generous free tier and is the common choice for
Next.js) wired into at minimum every API route's catch block, alerting to
**`status.report@igbobuigbo.org.ng`**, so failures surface somewhere a human will actually see
them.

**Partial mitigation this session:** the new in-app notification system (see C-14) gives members
a way to *see* their own transaction outcomes without needing to trust a toast that might have
been missed on a flaky connection — this doesn't replace real backend monitoring, but it closes
part of the "silent failure" gap on the user-facing side.

#### C-10 · Cost/quota planning for mass-scale email and SMS
**Gap:** Every registration now sends a verification email (this session) on top of the
existing welcome/approval emails, and Gmail (the primary path before Brevo fallback, per
`lib/emailRouter.ts`) has a ~500/day sending quota. At real mass-registration volume this quota
will be exhausted quickly, meaning Brevo's paid tier costs start accruing sooner than expected.
This isn't a bug, but it's a budget-planning gap worth having answered before launch, not
discovered mid-launch.

**Researched this session — free email tiers to chain before Brevo, current as of mid-2026:**
Emmanuel asked for 3 good free primary options ahead of the Brevo fallback. One correction to
flag first: **SendGrid's permanent free tier no longer exists** — Twilio retired it in May 2025;
new accounts now only get a 60-day trial before requiring a paid plan, so it's not a good pick
here despite being the "default" free option most people remember. Current permanent free tiers
worth chaining, in order:
1. **Gmail SMTP** (already integrated, `lib/mailer.ts`) — ~500/day.
2. **Resend** — 3,000/month (100/day cap), permanent free, clean API, good fit alongside a
   Next.js stack.
3. **Mailtrap** — 4,000/month permanent free.
4. Brevo's **own** free tier is 300/day, permanent — worth using before Brevo's *paid* tier
   kicks in, i.e. the "fallback" doesn't have to mean "starts costing money" until even Brevo's
   own free 300/day is exhausted.

Combined, that's real headroom before any cost is incurred. **Not implemented yet** — this is
research + a recommended chain order for `lib/emailRouter.ts` to route through, not code. Each
new provider needs its own API key signed up for by Emmanuel before it can be wired in.

**SMS fee idea (Emmanuel, this session):** charge members a small fee (suggested ₦10) per SMS
sent once a free SMS allotment (daily/weekly/monthly, admin-configurable) is used up — the same
free-then-paid shape as the email chain above, but charged to the member's wallet rather than
absorbed by IBI. This needs: an `smsFee` + `smsFreeAllowance` field added to
`settings/pricing` (small addition to the existing admin-configurable schema — `lib/pricing.ts`
already has the plumbing for this kind of field), a per-member SMS-sent counter with a reset
window, and a wallet debit (via `lib/wallet.ts`'s `atomicDebit`, now that it exists) wired into
`lib/termii.ts`'s send path before an over-allowance SMS goes out. Not built yet — needs its own
scoped session given the wallet-debit-on-send flow needs care (what happens if the member's
balance can't cover the fee — skip the SMS, or send anyway and let balance go to zero?).

#### C-11 · ✅ Admin pricing save failing with "Missing or insufficient permissions" — RESOLVED (two parts, this session)
**Part 1 — the write:** The Pricing tab's save action wrote directly to Firestore from the
browser via the client SDK, relying on the `settings/pricing` security rule's `isAdmin()` check.
This was the *only* admin write in the entire app that worked that way — every other admin
action (credit-wallet, approve-member, etc.) goes through a server route using the Admin SDK,
which bypasses Firestore rules entirely. Fixed by building `/api/admin/pricing` (POST), matching
`/api/admin/credit-wallet`'s exact pattern.

**Part 2 — the read (the actual explanation for "save said successful, but nothing changed
anywhere, and reverted on refresh"):** Fixing the write wasn't the whole story. `lib/pricing.ts`'s
`usePricingSettings()` — used by the membership page, upgrade modal, affiliate table, *and* the
admin panel's own form — still read `settings/pricing` with the **client SDK**, which depends on
that same security rule actually being **deployed** (`firebase deploy --only firestore:rules`).
Having the rule in the repo isn't enough; it has to be pushed. If that step was missed, every
read — including a fresh one after a hard refresh — was silently denied and fell back to
`DEFAULT_PRICING`, which is exactly what "reverted to status quo" describes: the "status quo"
being shown was the hardcoded default, unrelated to whatever was actually saved (which, per Part
1, likely *did* save correctly via the Admin SDK route, invisibly).

**Fix:** Built `GET /api/pricing` (public, Admin SDK, `Cache-Control: no-store`) and pointed
`lib/pricing.ts` at it instead of a direct client Firestore read. Pricing reads no longer depend
on rules deployment at all — both the read and write sides now go through server routes,
consistent with every other admin-sensitive flow in this app. The `settings/pricing` Firestore
rule is left in place as harmless defense-in-depth but is no longer load-bearing for the app to
function correctly.

#### C-12 · ✅ Dashboard "Make Donation" quick action left the dashboard — RESOLVED (this session)
**Was:** The Quick Actions grid on the overview page linked `Make Donation` to the public
`/donate` page, taking logged-in members out of the dashboard entirely — inconsistent with the
in-dashboard `DonateModal` built earlier this session for exactly this reason.

**Fix:** The tile now opens `DonateModal` in place, matching how `Make Donation` already behaves
from the sidebar and profile dropdown (`app/dashboard/layout.tsx`).

#### C-13 · ✅ No functional push notification service — FOUNDATION BUILT (this session)
**Was:** No notification system existed at all — no transaction alerts, no admin broadcast
capability, nothing.

**Built:** An in-app notification system (`lib/notifications.ts` + `app/api/notifications/*` +
`app/api/admin/notifications` + `components/dashboard/NotificationBell.tsx`) — a bell icon with
an unread counter in the dashboard header, backed by a single Firestore `notifications`
collection (`audience: 'all' | 'user'`, `readBy: string[]`). Server-routed throughout, same
lesson as C-11: nothing here depends on client Firestore rules. Wired into `wallet/transfer` and
`wallet/topup` as transaction alerts ("Money Received", "Transfer Sent", "Wallet Topped Up").
Admin gets a new **Notifications tab** in `/admin` to compose and send a broadcast (all members)
or a targeted notification (one member, picked from the already-loaded Active Members list).

**Deliberately NOT built yet — real OS-level push (Firebase Cloud Messaging).** The in-app bell
works immediately for every member with zero setup. Actual push notifications (the kind that
show up outside the browser tab, even app-closed) need Firebase Cloud Messaging, which requires
generating a VAPID key pair in the Firebase Console — a manual step only Emmanuel can do, so it's
out of scope for this session. When ready: the data model above doesn't need to change, just add
an FCM send call alongside the existing Firestore write in `lib/notifications.ts`, plus a service
worker (`public/firebase-messaging-sw.js`) and a client-side permission prompt + token
registration flow.

**Future IBI Ads use case (Emmanuel mentioned):** the exact same `createNotification()` /
`audience` targeting doubles as the mechanism for a future ad-push feature — just a different
`type` value and richer audience targeting (e.g. by chapter or tier) when that's built. No schema
change needed.

### 🟢 Also worth doing before mass registration (lower urgency, still real)

- **Firestore backup/disaster-recovery plan.** Real money is tracked in `walletBalance` and
  `transactions` now — losing this data isn't a UX inconvenience, it's a financial incident.
  Firestore supports scheduled exports to Cloud Storage; this isn't configured yet as far as
  this session found.
- **Session/device management for members.** Once PIN/2FA (C-01) exists, members should be able
  to see active sessions and sign out other devices — standard companion feature to any
  meaningful account-security step.
- **Data export / deletion request handling.** The Privacy Policy added this session commits to
  honoring access/correction/deletion requests (§7) — there's no admin tooling yet to actually
  fulfill one beyond manual Firestore console work. Fine at current scale, not at mass scale.
- **Legal pages need actual legal review.** FAQ, Privacy Policy, and Terms of Use were drafted
  this session (`app/faq`, `app/privacy`, `app/terms`) — accurate to how the platform currently
  works, but written by Claude, not a lawyer. Route to counsel before relying on them at scale,
  particularly the wallet/payment sections of the Terms.
- **Load-test the registration flow.** Firestore and Paystack both have rate limits that have
  never been tested against a real registration surge (e.g. a coordinated chapter recruitment
  push). Worth a synthetic load test before a marketing push, not after.

**B-35** (new, Part B): client-side wiring for the "possible duplicate transfer" confirmation
dialog — see TD-18. Server-side detection and response shape are ready; the wallet transfer form
needs a small addition to show the prompt and resubmit with `confirmDuplicate: true`.

**Troubleshooting note:** if `/api/admin/notifications` (or any other route from this session)
returns `Unexpected token '<', "<!DOCTYPE"` instead of JSON, that's Next.js serving its own HTML
404/error page — meaning the route file genuinely isn't present yet, not a code bug. This happens
when files built in a session haven't been copied into the actual project yet. Same explanation
covers pricing changes not reflecting: if `lib/pricing.ts` and `app/api/pricing/route.ts` (the
fix for C-11 Part 2) haven't been applied, the site is still running the version that silently
falls back to defaults.

---

## Summary Counts

| Category | Count | Resolved this session |
|----------|-------|------------------------|
| 🔴 Critical tech debt | 7 | 5 (TD-01, TD-02, TD-03, TD-17, TD-18) |
| 🟡 Important tech debt | 7 | 3 (TD-06, TD-09, TD-12) |
| 🟢 Minor tech debt | 4 | 0 |
| **Total tech debt items (Part A)** | **18** | **8 resolved, 10 open (TD-05 corrected, not a separate open item)** |
| Features to build (Part B) | 29 | B-35 added |
| 🔴 Pre-launch gate — must-fix (Part C) | 5 | 1 (C-01, PND-on-overdraft sub-item still open) |
| 🟡 Pre-launch gate — should-fix (Part C) | 6 | 3 (C-11, C-12, C-13) |
| 🟢 Pre-launch gate — also worth doing (Part C) | 5 | — |
| **Total backlog items** | **62** | — |

---

*Adams Consults — igbobuigbo.org.ng*
