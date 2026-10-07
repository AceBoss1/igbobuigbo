# IBI Portal — Project Map, Audit & Development Plan
*Audit date: 2026-10-07 · Read-only review of `main` @ ca21dd5. Complements `TECH_DEBT_AND_ROADMAP.md` (which stays the backlog of record).*

## 1. What the project is
Next.js 14 (App Router, TypeScript) member portal for Igbo Bu Igbo (IBI), backed by Firebase (Auth + Firestore, Admin SDK on the server), Paystack payments, Brevo/Gmail/Resend email, Termii SMS, Cloudinary photos. Deployed on Vercel (cron routes), Firestore rules in `firestore.rules`.

| Area | Where |
|---|---|
| Public site | `app/page.tsx`, `membership`, `chapters`, `constitution`, `donate`, `faq`, `terms`, `privacy`, `contact`, `verify` |
| Member dashboard | `app/dashboard/{overview,wallet,transfer,cards,idcard,affiliate,profile}` |
| Admin panel | `app/admin/page.tsx` + `app/api/admin/*` (inline admin / superadmin checks) |
| Money core | `lib/wallet.ts` (atomic Firestore transactions), `lib/pin.ts` (main + duress PIN), `lib/pinSession.ts` |
| Payments | `lib/paystack*.ts`, `app/api/webhooks/paystack`, `wallet/topup`, `donate`, `cards/order`, `membership/upgrade` |
| Ops | `RUNBOOK.md`, `app/api/cron/{backup,birthday}`, `.github/workflows/zap-baseline.yml` |

Size: ~190 source files, 52 API routes. Auth model: `__session` cookie (7-day Firebase session cookie) or Bearer ID token, checked per route by `lib/auth-middleware.ts`; `middleware.ts` only guards `/dashboard` and `/admin` pages.

## 2. Findings from this audit (NEW — not already in the roadmap)

### 🔴 Critical — fix before anything else
| ID | Finding | Evidence | Fix |
|---|---|---|---|
| A-1 | **Real-looking secrets are committed in `.env.example`**: Firebase Admin private key, Brevo API key, Cloudinary API secret, `ADMIN_BOOTSTRAP_SECRET`, plus Firebase/EmailJS keys. The file is tracked in git history (first commit). | `.env.example` lines 19–50 | **Rotate every one of them now** (Firebase service-account key, Brevo, Cloudinary, bootstrap secret). Replace values in `.env.example` with placeholders. Removing from the file is not enough — the history still holds them, so rotation is mandatory. If the repo is public, assume they are already harvested. |
| A-2 | **Free-money exploit in `POST /api/affiliate/withdraw`**: credits whatever `amount` (≥ ₦500) the client sends to the wallet. It never reads the member's real affiliate earnings, then marks *all* pending referrals paid. Also non-atomic (read-then-write). | `app/api/affiliate/withdraw/route.ts` | Compute payable commission server-side from `referrals` (status `pending`), ignore client `amount`, and do referral-paid + `atomicCredit` in one Firestore transaction with an idempotency key. |
| A-3 | **Wallet corruption via string amounts** in `POST /api/wallet/transfer`: `amount` is only checked with `< 100`, so `"100"` passes. In `atomicTransfer`, `recipientBalance + amount` then does string concatenation (`50000 + "100"` → `"50000100"`), writing a string into the recipient's `walletBalance`. A member can corrupt another member's balance. `wallet/debit` and `affiliate/withdraw` have the same untyped-amount weakness. | `lib/wallet.ts:159-162`, `transfer/route.ts:49` | Validate in one shared helper: `Number.isFinite(amount) && Number.isInteger(amount) && typeof amount === 'number' && amount > 0`; also assert inside `atomicDebit/Credit/Transfer`. Audit existing `members.walletBalance` values for non-number types. |

### 🟠 High
| ID | Finding | Fix |
|---|---|---|
| A-4 | **`next build` will fail**: `typescript.ignoreBuildErrors` is `false` and `tsc` reports 3 errors — `contact/route.ts:53` (`replyTo` not in `EmailParams`), `donate/route.ts:197` (`name` not in `EmailParams`), `lib/orgWallets.ts:86` (`Date` vs `Timestamp` cast). The contact form and donation receipt email therefore also silently drop those fields. | Extend `EmailParams` (or fix call sites); fix the cast. Then run `tsc --noEmit` in CI. |
| A-5 | **Paid-tier registration can skip payment**: `isFreeRef = !paystackRef \|\| startsWith('FREE-')` bypasses verification for any tier, and if `PAYSTACK_SECRET_KEY` isn't `sk_…` the check is skipped ("allow for now"). Verification also ignores amount and never records the reference, so one real reference can be replayed for many registrations. Mitigated only because paid tiers land as `pending` for admin approval. | Fail closed: paid tier ⇒ reference required, verified, amount == tier price, reference unused (store it). |
| A-6 | **Recipient lookup scans only the first 500 members** (`members.limit(500)`, filtered in JS) in `wallet/transfer` GET and POST. Once membership passes 500, valid IBI numbers return "not found"; it is also an O(n) read per transfer (cost). | Query by indexed field (`ibiNumber`, `ibiDigits`) with `where().limit(1)`; add to `firestore.indexes.json`. |
| A-7 | **ESLint is not configured** (`next lint` opens an interactive setup prompt; no `.eslintrc`), so `eslint.ignoreDuringBuilds:false` provides no real protection. | Add `.eslintrc.json` (`next/core-web-vitals`), wire into CI. |
| A-8 | **Build artifacts are committed**: 196 files under `.next/` are tracked (and `.next` is not in `.gitignore`) — stale caches, merge conflicts, repo bloat. `public/` also holds ~15 MB of PNG/MP4 assets. | `git rm -r --cached .next`, add `.next/` to `.gitignore`; optimise images (WebP already exists for most cards — drop the PNG originals from `public/`). |

### 🟡 Medium
- **A-9** `NEXT_PUBLIC_` prefix on server secrets in `.env.example` (`…BREVO_API_KEY`, `…CLOUDINARY_API_SECRET`, `…FIREBASE_ADMIN_CLIENT_EMAIL`). Nothing in code reads those names today, but if anyone sets them as written they get bundled into the browser. Rename to non-public names.
- **A-10** Webhook/cron secret comparisons use `!==` (not timing-safe). Use `crypto.timingSafeEqual`.
- **A-11** `middleware.ts` makes an extra HTTP round-trip to `/api/auth/verify` on every page navigation; `/api/auth/verify` is unauthenticated and echoes email/admin status for any valid cookie. Verify inside the route handlers/server components instead, or cache.
- **A-12** `affiliate/withdraw`, `membership/*`, `donate` etc. have no input schema validation; adopt `zod` shared validators (also fixes A-3).
- **A-13** `transactions` writes use `new Date()` (client of Admin SDK) – fine, but duplicate-transfer check in `wallet/transfer` fetches 20 unordered debits (`limit(20)` with no `orderBy`) so it can miss the recent one for busy accounts.
- **A-14** CSP `connect-src` doesn't list Cloudinary upload or Brevo/EmailJS client calls; verify on staging (already flagged in `next.config.js`).
- **A-15** `package.json`: `nodemailer@^9` / `@types/nodemailer@^8` mismatch, both `resend` and `@emailjs/browser` and Brevo present — consolidate to the router in `lib/emailRouter.ts`. Run `npm audit`.

### ✅ Checked and OK
Wallet atomicity (`lib/wallet.ts`) is sound for debit/credit/transfer; PIN hashing + lockout; Paystack webhook signature on raw body; Firestore rules deny all client writes on money collections; every `app/api/admin/*` route has an inline admin/superadmin check; rate limits on register/session/set-admin/qr.

## 3. Already tracked in `TECH_DEBT_AND_ROADMAP.md` and still open
C-02 PND UI (API exists), C-04 reconciliation job, C-05 KYC hook, C-06 broader rate limiting, C-07 central audit log, C-08 duplicate-registration (phone), C-09 Sentry, C-10 email/SMS quotas, B-35 duplicate-transfer confirm dialog, TD-04/07/08/10/11/13–16, Sprints 1–5 features.

## 4. Proposed plan

### Phase 0 — Stop the bleeding (this week, before any feature work)
1. Rotate all secrets in A-1; scrub `.env.example`; confirm repo visibility (make private if public).
2. Fix A-2 (affiliate payout) and A-3 (amount validation + shared validator). Add a one-off script to find any non-numeric `walletBalance` and any suspicious `AFF-PAY-` credits to reverse.
3. Fix A-4 so the app builds; add CI (`tsc --noEmit`, lint, build) on every PR.
4. Untrack `.next/`, optimise `public/` assets (A-8).

### Phase 1 — Launch gate hardening (2–3 weeks)
A-5 (registration payment), A-6 (indexed recipient lookup), A-7 (ESLint), C-02 PND admin UI, C-07 audit log, C-06 rate limits on wallet/payment routes, B-35 duplicate-confirm dialog, unit tests for `lib/wallet.ts` + payment routes (B-34) using the Firestore emulator.

### Phase 2 — Observability & compliance (2–4 weeks)
C-09 Sentry, C-04 reconciliation cron, C-05 KYC interface, C-08 phone dedupe, C-10 email chain, FCM push (C-13 remainder), legal review of Terms/Privacy.

### Phase 3 — Product roadmap (Sprints 1–4)
B-01/02 affiliate metrics → B-03/04/10 USD rate + USD cards → Sprint 2 admin (members, ledger CSV, card order status, donations) → Sprint 3 fintech (Save2Pay, escrow marketplace, 3-balance wallet, transfer fee) → Sprint 4 logistics/communications.

### Working agreements
- No direct pushes to `main`; PR + CI green. Branch naming `claude/…` for AI work.
- Money code changes require a test and a RUNBOOK note.
- `sync.sh` is a convenience for your local checkout; it is not a substitute for PR review.
