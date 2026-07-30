# IBI — Main + Duress PIN System — Apply Manifest

13 files. New PIN infrastructure (main + duress, PIN3/flex dropped per your confirmation) plus
the two fixes from before it (receipt reference number, transfer confirmation modal — those were
already delivered in `ibi-receipt-and-transfer-confirm.zip`, not repeated here).

## New files
- `lib/pin.ts` — hashing (Node's built-in scrypt, no new dependency) + rate-limiting (5 wrong attempts → 15-min lock)
- `lib/pinSession.ts` — SERVER-side duress-session tracking (httpOnly cookie + Firestore record) — this is what actually enforces the duress cap, never the client
- `lib/pinSessionClient.ts` — CLIENT-side display-only mode (sessionStorage) — cosmetic only, never trusted for enforcement
- `components/dashboard/PinGateModal.tsx` — the session-entry PIN prompt (handles both first-time setup and later verification)
- `app/api/wallet/pin/set/route.ts` — set/change main PIN
- `app/api/wallet/pin/set-duress/route.ts` — set up duress PIN (requires main PIN)
- `app/api/wallet/pin/verify/route.ts` — verify a PIN, issues the server-side session
- `app/api/wallet/pin/status/route.ts` — checks whether a PIN is set up yet

## Changed files
- `app/dashboard/wallet/page.tsx` — PIN gate on entry, masked balance, duress-scaled display
- `app/dashboard/overview/page.tsx` — same gate + masking on the wallet balance stat card
- `app/dashboard/profile/page.tsx` — new "Wallet PIN & Security" section: change main PIN, set up duress PIN (the only place both are visible/manageable together, by design)
- `app/api/wallet/transfer/route.ts` — server-enforced duress cap (real balance ÷ 100), on top of the receipt-reference and duplicate-warning fixes from before
- `TECH_DEBT_AND_ROADMAP.md` — C-01 marked built, with the flex-PIN decision and the still-open PND-on-overdraft question documented

## Still open (documented, not built)
The auto-lift PND-on-overdraft idea from your original spec — flagged as a compliance concern
(fake KYC paper trail) rather than built either way. Currently a duress-mode overdraft attempt
just gets rejected with a generic "Insufficient wallet balance" message (deliberately generic —
doesn't reveal duress mode is active). Needs your call on whether/how to build the PND flow
before that part exists.

## To test
1. Visit `/dashboard/wallet` or `/dashboard/overview` — you'll be prompted to set up a PIN (first
   time) since none exists yet for any member.
2. Set your main PIN. Balance should now show correctly.
3. From `/dashboard/profile`, set up a duress PIN (needs your main PIN to confirm).
4. Open a new incognito/private window (fresh session), log in, go to Wallet, enter the DURESS
   PIN this time — balance should show as 1% of real, and a transfer attempt above that 1% cap
   should be rejected server-side even if you inspect/edit the request.
