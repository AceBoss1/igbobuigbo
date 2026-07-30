# IBI Platform — Reference Code Prefixes (Appendix)

All transaction, document, and identity references used across the
Igbo Bu Igbo platform. Every reference below is verifiable at
**https://igbobuigbo.org.ng/verify**

---

## 1. Paystack Payment References
*Generated client-side before opening Paystack. Format: `PREFIX-{Date.now()}`*

| Prefix | Example | Trigger | Firestore Collection |
|--------|---------|---------|----------------------|
| `IBI-REG-` | `IBI-REG-1782472000000` | New membership registration | `memberRegistrations` |
| `IBI-UPG-` | `IBI-UPG-1782472678526` | Membership tier upgrade (Paystack) | `memberUpgrades` |
| `IBI-DON-` | `IBI-DON-1782472000000` | Donation (Paystack) | `donations` |
| `IBI-CARD-` | `IBI-CARD-1782472000000` | IBI Card purchase (Paystack) | `cardOrders` + `transactions` |
| `IBI-WLT-` | `IBI-WLT-1782472000000` | Wallet top-up (Paystack) | `transactions` |

---

## 2a. Chapter/Region Transfer References
*Generated server-side by `/api/membership/transfer` — NOT a money-moving
reference, stored in the separate `transfers` collection, never
`transactions`.*

| Prefix | Example | Description | Firestore Collection |
|--------|---------|-------------|----------------------|
| `IBI-CHTRF-` | `IBI-CHTRF-MRUOXLGC` | Chapter/region membership transfer application | `transfers` |

> **Fixed collision:** this used to share the plain `TRF-` prefix with
> wallet-to-wallet money transfers (§2 below). Both are generated with the
> identical `PREFIX-{Date.now().toString(36).toUpperCase()}` format, so a
> chapter-transfer ref and a wallet-transfer ref were textually
> indistinguishable. The verify portal hard-routes any `TRF-*` ref to the
> `transactions` collection (see §6) — chapter transfers, being stored in
> `transfers`, could never be found there, and there was no separate admin
> route/UI reading the `transfers` collection at all, so pending
> applications were invisible to admins too. `IBI-CHTRF-` removes the
> collision; `/verify` and `/admin` (Chapter Transfers tab) both handle it
> as its own type now. Approval/rejection fires a bell 🔔 in-app
> notification to the member in addition to email/SMS.

> **Public transparency vs. private balance:** `/verify`'s public wallet
> result shows `totalReceived` — a cumulative, monotonically-increasing
> total of everything ever credited to that wallet — never the live
> `balance`. `totalReceived` only ever goes up, even once Phase 2
> introduces remittances/debits moving money back out, so it stays a true
> historical record. `balance` (current spendable amount) stays admin-only
> (visible in the Org Wallets admin tab) — publishing exact live
> cash-on-hand for a small org's national/chapter purse is a solicitation
> and targeting risk with no offsetting transparency benefit; the
> cumulative total already gives a grant reviewer or auditor everything
> they need to independently verify real financial activity.

---

## 2b. Purse Wallet Addresses & Manual Credit References
*National/regional/chapter purse wallets — `lib/orgWallets.ts`. Every
scope gets exactly TWO wallets (main + donation), address deterministic,
not random.*

| Format | Example | Description |
|--------|---------|-------------|
| `{CHAPTER_CODE}/0000000001` | `ANA/0000000001` | Chapter main purse |
| `{CHAPTER_CODE}/0000000002` | `ANA/0000000002` | Chapter donation purse |
| `{REGION_CODE}/0000000001` | `ISS/0000000001` | Regional main purse (ISS=Region 1, NIS=Region 2, GDS=Region 3) |
| `{REGION_CODE}/0000000002` | `ISS/0000000002` | Regional donation purse |
| `IBI/0000000001` | — | National main purse |
| `IBI/0000000002` | — | National donation purse |
| `IBI/0000000003` | — | **National grant purse — national scope only** |
| `ORGWLT-{timestamp}` | `ORGWLT-1784856801943` | Manual admin credit to any of the above (e.g. a bank transfer received outside Paystack) |

> **Grants are national-only by design, not by current omission.**
> Regions and chapters do not apply for or hold grant funds
> independently — `getOrCreateOrgWalletSet()` in `lib/orgWallets.ts` only
> ever creates a `grant` wallet for `scope === 'national'`, and
> `creditOrgWallet()` throws if anyone tries to credit a `grant` wallet at
> the region or chapter level. When grant money needs to reach a region
> or chapter, that's a supervised transfer OUT of `IBI/0000000003` into
> that scope's ordinary main purse (`{CODE}/0000000001`) — not a grant
> wallet of its own. The actual transfer mechanism for that is Phase 2,
> same as auto-remittance (§ above) — this just establishes where grant
> funds live in the meantime, consistent with the constitution's Article
> 8 income sources ("donations, grants and contributions") — full text at
> igbobuigbo.org.ng/constitution.

> **Address/Member Number collision:** a purse wallet address is
> textually identical in shape to a member's IBI Number
> (`[A-Z]{2,8}/\d{10}`) — e.g. `ANA/0000000001` looks exactly like a
> member number from the Anambra chapter. `/verify` handles this by
> trying the `members` collection first (existing behavior); if no member
> matches, it falls back to checking `orgWallets` by address before
> giving up (`verifyMemberOrOrgWallet()`). Balance is deliberately not
> shown on the public wallet result — only which chapter/region/national
> body it belongs to and its purse type.
>
> **Chapter donation attribution:** a donation credits a chapter's
> donation purse either because the donor explicitly picked that chapter
> from the donate form's dropdown, or — as a fallback when they didn't —
> a best-effort match against the chapter name mentioned in their
> optional message field (`matchChapterFromText()` in
> `lib/orgWallets.ts`). No match on either → credits the national
> donation purse instead.
>
> **Lazy creation:** a chapter or region's wallet SET (both main and
> donation) is created automatically the first time any donation or due
> touches that scope — most of the 43 chapters won't have wallets at all
> until their first transaction. `/verify` also provisions a wallet set
> on lookup if it's missing, for any address that positively matches a
> real chapter/region/national code — so checking a legitimate but
> not-yet-used wallet (e.g. a grant reviewer verifying `IBI/0000000003`
> before IBI has received its first grant) shows "exists, ₦0 received so
> far," not "not found," which would otherwise be indistinguishable from
> the wallet never having been real at all. This never provisions for an
> arbitrary guessed code — only ones matching the static, known list of
> chapters/regions/national.

---

## 2. Wallet Transaction References
*Generated server-side when IBI Wallet is the payment method.*
*Format: `PREFIX-{Date.now()}` on the server*

| Prefix | Example | Description | Firestore Collection |
|--------|---------|-------------|----------------------|
| `TRF-` | `TRF-MQMS6JV1` | Wallet-to-wallet transfer | `transactions` |
| `IBI-TRF-` | `IBI-TRF-1782472000000` | Internal wallet transfer (alternate) | `transactions` |
| `IBI-UPG-WLT-` | `IBI-UPG-WLT-1782342183999` | Membership upgrade via IBI Wallet | `memberUpgrades` + `transactions` |
| `IBI-DON-WLT-` | `IBI-DON-WLT-1782472000000` | **Donation via IBI Wallet** | `donations` + `transactions` |
| `CARD-` | `CARD-1781839496090` | Card issuance debit via wallet | `transactions` + `cardOrders` |

> **Why `IBI-DON-WLT-` is separate from `IBI-DON-`:**
> DualPayment reuses the Paystack `paystackRef` for wallet debit calls, meaning
> both Paystack and wallet donations would share the `IBI-DON-` prefix and be
> indistinguishable in statements and the verify portal.
> To keep them distinct, the donation API must generate `IBI-DON-WLT-{timestamp}`
> server-side when `method === 'wallet'` — see `/api/donate/route.ts`.

---

## 3. Admin & System References
*Generated by the admin panel or platform automations*

| Prefix | Example | Description | Firestore Collection |
|--------|---------|-------------|----------------------|
| `ADMIN-` | `ADMIN-1781990234702` | Admin credit / debit / manual adjustment | `transactions` |
| `IBI-AFF-` | `IBI-AFF-SEED1` | Affiliate commission credit | `transactions` |
| `IBI-BONUS-` | `IBI-BONUS-1782472000000` | Platform bonus credit | `transactions` |
| `IBI-REF-` | `IBI-REF-1782472000000` | Referral reward credit | `transactions` |

---

## 4. Document References
*Embedded inside generated PDFs and QR codes*

| Prefix | Format | Description |
|--------|--------|-------------|
| `IBI-STMT-` | `IBI-STMT-{CHAPTER}-{DIGITS}_{YYYYMMDD}-{YYYYMMDD}` | Wallet statement PDF |
| `IBI-WYB-` | `IBI-WYB-{alphanumeric}` | Delivery / logistics parcel tracking |

**Statement example:**
`IBI-STMT-OTH-8263354454_20260521-20260621`

Verified at: `/verify?ref=IBI-STMT-OTH-...&key={AUTH_KEY}`

---

## 5. Identity References
*Assigned at registration — displayed on ID card and encoded in QR code*

| Format | Example | Description |
|--------|---------|-------------|
| `{CHAPTER}/{10DIGITS}` | `ANA/8263354454` | Nigerian chapter member |
| `{CHAPTER}/{10DIGITS}` | `OTH/8263354454` | Overseas / Other chapter member |
| `LAG/8263354454` | Lagos chapter member | Chapter code varies per branch |

---

## 6. Verify Portal — Auto-Detection Logic

The `/verify` page auto-detects reference type by prefix (case-insensitive):

```
IBI-STMT-*        → Wallet Statement      (requires &key= Auth Key param)
IBI-CHTRF-*       → Chapter/Region Transfer Application
IBI-UPG-WLT-*     → Upgrade via Wallet
IBI-UPG-*         → Upgrade via Paystack
IBI-DON-WLT-*     → Donation via Wallet
IBI-DON-*         → Donation via Paystack
ORGWLT-*          → Purse Wallet Manual Credit (admin action)
IBI-AFF-*         → Affiliate Commission
IBI-BONUS-*       → Bonus Credit
IBI-REF-*         → Referral Reward
ADMIN-*           → Admin Credit / Adjustment
IBI-CARD-* / CARD-* → Card Issuance
TRF-* / IBI-TRF-* / IBI-WLT-* → Wallet Transaction / Top-Up
IBI-WYB-*         → Parcel / Logistics Tracking
[A-Z]{2,8}/\d{10} → Member Identity (IBI Number) — OR a Purse Wallet address
                    (ANA/0000000001) if no member matches that number; see §2b.
```

> Detection is ordered — more specific prefixes (`IBI-DON-WLT-`,
> `IBI-CHTRF-`) are checked before general ones (`IBI-DON-`, `TRF-`) to
> avoid misclassification. `IBI-CHTRF-` in particular MUST be checked
> before the generic `TRF-` match, since stripping the `IBI-` leaves a
> string that still starts with `TRF`.

---

## 7. Naming Rules

| Rule | Detail |
|------|--------|
| **Format** | `PREFIX-{Date.now()}` (server) or `PREFIX-{Date.now()}` (client) |
| **Uniqueness** | `Date.now()` in ms ensures global uniqueness within a session |
| **No slashes** | Slashes appear in Member IBI Numbers (`ANA/8263354454`) and Purse Wallet addresses (`ANA/0000000001`) — nowhere else. See §2b for how `/verify` disambiguates the two. |
| **Case** | Stored as-is; verify portal normalises to UPPER before matching |
| **Immutable** | References are never modified after creation in Firestore |
| **Idempotency** | Each route checks for duplicate references before processing |

---

## 8. Full Prefix Inventory

```
IBI-REG-        Membership registration (Paystack)
IBI-UPG-        Membership upgrade (Paystack)
IBI-UPG-WLT-    Membership upgrade (Wallet)
IBI-DON-        Donation (Paystack)
IBI-DON-WLT-    Donation (Wallet)          ← was previously missing
IBI-CARD-       Card purchase (Paystack)
IBI-WLT-        Wallet top-up (Paystack)
IBI-TRF-        Wallet transfer (internal)
IBI-CHTRF-      Chapter/region transfer application  ← was previously TRF- (collision, fixed)
ORGWLT-         Purse wallet manual admin credit (national/regional/chapter)
{CODE}/000000000{1|2}  Purse wallet address (main/donation) — collides in
                        shape with member IBI numbers, see §2b
IBI-STMT-       Wallet statement document
IBI-WYB-        Parcel / logistics tracking
IBI-AFF-        Affiliate commission
IBI-BONUS-      Platform bonus
IBI-REF-        Referral reward
TRF-            Wallet transfer (short form)
CARD-           Card issuance (wallet debit)
ADMIN-          Admin adjustment
```

---

*Last updated: June 2026 — Adams Consults for Igbo Bu Igbo Unity & Cultural Preservation Initiative*
