# eSariSari FinOps MVP — App & modules (verified)

**Status:** Living product map for the **whole app**, not Internet Credits only  
**Last verified:** 2026-08-18 against current code (`src/lib`, `src/pages`, `src/layouts`, `src/services`, `src/data/seed.js`)  
**Related:** [Internet Credits business model review](./internet-credits-business-model-review.md) (deposit-rate lock + §11 IC details)

This is a React / Vite demo that persists to `localStorage`. There is no backend. Reset Demo Data restores seed.

---

## Table of contents

1. [What the product does](#1-what-the-product-does)
2. [Demo network and logins](#2-demo-network-and-logins)
3. [Shell, auth, and navigation](#3-shell-auth-and-navigation)
4. [Module catalog](#4-module-catalog)
5. [Role matrix](#5-role-matrix)
6. [Money math (both streams)](#6-money-math-both-streams)
7. [Not in v1 / leftovers](#7-not-in-v1--leftovers)

---

## 1. What the product does

Four roles sit in a hierarchy:

**Platform Admin → Sub-Franchisee → Franchisee → Retailer**

Two separate money events:

| Event | Who acts | What moves | Earnings |
|-------|----------|------------|----------|
| **Internet Credits load** | Upline releases credits after cash + proof (request or Direct Release) | Credits into downline **Available Credits** | **Internet Credits earnings** — Admin: cash collected; Sub/Fran: deposit-rate spread |
| **Internet sale** | Retailer records a demo sale | Credits **burned** from retailer Available Credits | **Sales Commission** — each tier’s % of the **commission pool** |

They are not interchangeable. Deposit Rates price loads. Commission Settings split each sale.

---

## 2. Demo network and logins

Non-admin password: `password123`. Admin is marked Restricted on the login screen; password is `abc12345678`. Clicking a demo account fills email only (not the password).

| Login | Org | Parent | Opening Available Credits |
|-------|-----|--------|---------------------------|
| `admin@esarisari.local` | eSariSari Platform | — | ₱500,000 |
| `subfranchisee@esarisari.local` | Northern Mindanao Sub-Franchisee | Platform | ₱135,000 |
| `franchisee-a@esarisari.local` | Franchisee A | Sub | ₱0 |
| `franchisee-b@esarisari.local` | Franchisee B | Sub | ₱0 |
| `retailer-a@esarisari.local` | Retailer A (`RT-00001`) | Franchisee A | ₱0 |
| `retailer-b@esarisari.local` | Retailer B (`RT-00002`) | Franchisee A | ₱0 |
| `retailer-c@esarisari.local` | Retailer C (`RT-00003`) | Franchisee B | ₱0 |

Fran/retailer start at zero so they must request or receive a Direct Release. Admin and Sub keep mock inventory so they can release.

Sales ledger starts empty (`TRANSACTIONS_SEED_VERSION = empty-demo-v1`). Internet Credits history starts empty (`INTERNET_CREDITS_SEED_VERSION = empty-demo-v3`).

Default deposit rates: **60%** Admin→Sub, **70%** Sub→Fran, **80%** Fran→Retailer.

Default sale split (when a retailer has no Commission Settings row): **30% retailer / 20% franchisee / 10% sub-franchisee / 40% platform**. Shares are stamped onto each sale.

---

## 3. Shell, auth, and navigation

### Login (`/login`)

Email + password. Unauthenticated users are sent here. Authenticated users hitting `/login` redirect to their first enabled nav item.

### App chrome

Header: organization name, **notification bell**, role badge, user menu (Profile, Reset Demo Data, Logout). Sidebar (and mobile sheet) from `NAV_ITEMS` in `src/lib/permissions.js`.

**Notifications** are live alerts for the signed-in org:

- **Pending Internet Credits requests** from direct downlines (not Direct Release). Clicking opens Internet Credits. Updating a still-pending request marks the alert unread again. The alert drops off when the request is released, rejected, or deleted.
- **Low/zero Available Credits** for the org and its downlines at or below ₱5,000. Clicking opens that role’s wallet page.

Read state is per organization in `localStorage`.

**Reset Demo Data** restores wallets, requests, transactions, rates, and commission settings to seed.

**Profile** (`/profile`) — all authenticated users. Name, email, role, organization. No edit.

### Home path (first enabled nav item)

| Role | Lands on |
|------|----------|
| Admin | `/wallets` |
| Sub-Franchisee | `/wallet-management` |
| Franchisee | `/wallet-management` |
| Retailer | `/wallet` |

### Nav vs routes

Greyed-out items stay visible but `canAccessRoute` blocks them. Dashboard exists as a page with role-specific cards, but it is disabled for **every** role including Admin, and the route is Admin-only — so it is unreachable in v1.

| Nav item | Path | Who sees it | Live? |
|----------|------|-------------|-------|
| Dashboard | `/dashboard` | All (greyed) | No — disabled |
| Organizations | `/organizations` | Admin (greyed) | No — placeholder |
| Franchisees | `/franchisees` | Sub (greyed) | No — no route; page file is a placeholder |
| Retailers | `/retailers` | Fran (greyed) | No — placeholder; route exists but blocked |
| Wallets | `/wallets` | Admin | Yes |
| Wallets | `/wallet-management` | Sub, Fran | Yes |
| Wallet | `/wallet` | Retailer | Yes |
| Internet Credits | `/funding` | Admin, Sub, Fran | Yes |
| Internet Credits | `/request-funding` | Retailer | Yes (same workspace, request-only) |
| Deposit Rates | `/deposit-rates` | Admin, Sub, Fran | Yes |
| Commission Settings | `/commission-settings` | Admin, Sub | Yes |
| Transactions | `/transactions` | All | Yes |
| Revenue | `/revenue` | All | Yes |
| Reports | `/reports` | All | Yes |

`/revenue-sharing` redirects to `/commission-settings`. The old `RevenueSharingPage` is unused.

---

## 4. Module catalog

### 4.1 Wallets / Wallet Management / Wallet

**Purpose:** Credit inventory directory. Loads happen on Internet Credits, not here.

**Available Credits** = operating / master wallet. Low = Available Credits ≤ ₱5,000; Zero = ≤ ₱0. Seed still stores `minimumBalance: 5000` for alerts. The wallet details sheet does **not** show a Minimum Balance card. Retailer’s Wallet page still prints “Min. ₱5,000” under Available Credits.

Hidden **revenue wallets** exist per org and are reconciled to credited sale-commission totals. They are not listed in the Credits Directory.

**Admin `/wallets`**

- Cards: Platform Available Credits, Sub-Franchisee Total, Franchisee Total, Retailer Total, Network Wallets (low/zero count)
- Credits Directory of the whole tree; Low Balance filter; View opens details + recent credit activity

**Sub / Fran `/wallet-management`**

- Your Available Credits
- Sub also sees Franchisee Credits
- Retailer Credits
- Network / Managed Credits (low/zero)
- Directory is scoped: Sub = franchisees + nested retailers; Fran = self + own retailers

**Retailer `/wallet`**

- Available Credits + status
- Sale Margin (all-time customer payment − credits consumed) — this is the **commission pool**, not the retailer’s take-home
- Upline name
- Recent Credits Activity (releases in)

Details sheet: owner, Available Credits, parent org, recent activity (date, type, signed amount). Formula shown: Available Credits = opening inventory + credit activity.

---

### 4.2 Internet Credits

**Purpose:** Move credit inventory down the chain after cash deposit + proof. Full workflow lock is in the [business model review §11](./internet-credits-business-model-review.md#11-shipped-updates-2026-08-18--verified).

**Formula:** `credits = deposit ÷ deposit rate`. Admin **mints**. Sub/Fran release from their Available Credits and cannot over-release. Payment reference is required on release. Reject requires a reason.

| Role | Incoming tab | My Credits Request | Direct Release | New request |
|------|--------------|--------------------|----------------|-------------|
| Admin | Sub pending requests | — | Yes (to Sub) | No |
| Sub | Franchisee pending | Yes (to Admin) | Yes (to Fran) | Yes |
| Fran | Retailer pending | Yes (to Sub) | Yes (to Retailer) | Yes |
| Retailer | — | Yes (to Fran) | No | Yes |

No Transfer History tab. Direct Release skips the pending queue; it still uses deposit ÷ rate, proof, and payment ref. History: **Released / History** (upline) and **My Credits Request** (downline). Type = Request vs Direct Release.

Pending requester actions: **Update** and **Delete** (not after release/reject; not for Direct Release). Update reapplies the **live** deposit rate, not the original snapshot.

Metric cards use **all** requests (not pending-only tabs): Pending Deposits, Pending Credits, Credits Released, plus My Pending when the role can request.

**Reverse** is not in the UI. `reverseInternetCredits` remains in `fundingActions.js`, unused.

---

### 4.3 Deposit Rates (`/deposit-rates`)

**Who:** Admin, Sub, Fran. Retailer has no page (rate is shown on the request calculator).

**What it prices:** Internet Credits **loads only**. Not sale commission.

Admin sees every direct downline (hop column). Sub sees franchisees. Fran sees retailers. Each row is Default (60/70/80 hop) or Custom override. Edit / restore default.

Copy on the page states that sale splits live in Commission Settings.

---

### 4.4 Commission Settings (`/commission-settings`)

**Who:** Admin and Sub-Franchisee. Franchisee and Retailer do not configure splits.

**What it prices:** Each internet sale’s **commission pool**.

Per-retailer rows: retailer / franchisee / (sub) / platform %. Active vs Inactive. Adding an Active row for a retailer inactivates the previous Active row for that retailer.

Normalization:

- Full chain (retailer → fran → sub → platform): retailer + franchisee + **fixed platform 40%**; remainder → sub-franchisee
- No sub in the chain: remainder → company (platform)

Engineered paths exist for retailer or franchisee attached straight to Admin (`DIRECT_TO_ADMIN`). The current seed is a full chain only.

These % are **stamped on the sale**. Changing settings later does not rewrite completed transactions.

---

### 4.5 Transactions (`/transactions`)

**Title:** Transactions Ledger. Completed sales only.

**Retailer only:** **Record demo sale** — product/service + customer payment. Credits consumed = 95% product cost + 2% processing = **97%** of payment. Commission pool = remaining **3%**. Sale is blocked if Available Credits &lt; credits consumed. Shares come from that retailer’s Active Commission Settings (or the 30/20/10/40 default).

Columns: Reference, Date, Retailer (Admin/Sub/Fran), Customer Payment, Credits Consumed, **Sale Margin** (same number as commission pool), Your Share / Platform Share, Status, View.

Filters: date range, retailer (uplines), search. Export CSV from this page.

Transaction details: payment, credits consumed, sale margin, 4-tier distribution (entity, %, amount).

---

### 4.6 Revenue (`/revenue`)

Default period: this month. Search + date filters.

**Admin / Sub / Fran cards:** Internet Credits earnings → Sales Commission → Total earnings.

**Retailer cards:** Your Commission → Sales volume → Credits consumed. No Total earnings card (retailer has no load-spread stream).

**Internet Credits earnings table** (not Retailer): each release with cash, credits, earnings. ⓘ beside the amount:

- Mid-tier: cost = credits × buy rate; earnings = cash − cost = credits × (sell − buy)
- Admin: earnings = cash collected at release

This is inventory markup, not sale commission.

**Sales Commission table:** Commission pool, Your share %, Your commission. View opens the same sale details dialog.

The Internet Credits table has `id="internet-credits"`. Reports can open this page with `?range=…` (and `from`/`to` for custom) so the period matches, then scroll to that table.

---

### 4.7 Reports (`/reports`)

Default period: this month. Admin/Sub: network franchisee filters. Fran: retailer filter.

**Hero cards (Admin / Sub / Fran):** Internet Credits earnings → Sales Commission → Total earnings → Sales Volume.

The **Internet Credits earnings** card links to Revenue with the **same period** (`/revenue?range=…#internet-credits`). That is the line-item ledger (each release + ⓘ formula). Reports does **not** copy that table.

**Internet Credits by downline** (Admin / Sub / Fran): rollup of the same earnings entries — downline, cash in, credits, earnings, plus a total row. One row per downline, not per release. Empty when nothing was released in the period.

**Retailer:** Sales Commission + Sales Volume only (no Internet Credits earnings / Total earnings cards, no by-downline rollup).

Network tables (Admin/Sub/Fran as scoped): Franchisee Commissions and Retailer Commissions use **Commission pool**, not “% of yours”.

**CSV exports** (counts follow the selected period):

| Export | Who | Contents |
|--------|-----|----------|
| Transactions | All | Payment, credits consumed, commission pool, split %, your share |
| Sales Commission | All | Pool, your share %, your commission |
| Internet Credits earnings | Admin / Sub / Fran | Cash in, credits, earnings, rates, cost basis |
| Internet Credits Requests | Roles with funding export | Includes Type (Request vs Direct Release) |
| Internet Credits Releases | Roles with funding export | Release ledger |

---

### 4.8 Placeholders and unused files

| Surface | Status |
|---------|--------|
| Dashboard page | Built, **nav-disabled for all roles**, Admin-only route also blocked by `disabledRoles` |
| Organizations | Placeholder copy only; nav disabled |
| Franchisees | Placeholder file; **no route** in `AppRoutes.jsx`; nav disabled |
| Retailers | Placeholder; route exists, nav disabled so unreachable |
| `SubFranchiseeFundingPage.jsx` | Deprecated wrapper around FundingWorkspacePage |
| `RevenueSharingPage.jsx` | Orphan; `/revenue-sharing` redirects to Commission Settings |

---

## 5. Role matrix

What each role can **do** in v1 (enabled modules only).

| Capability | Admin | Sub | Fran | Retailer |
|------------|:-----:|:---:|:----:|:--------:|
| See own + downline Available Credits | ✓ | ✓ | ✓ | own only |
| Request credits from upline | — | ✓ | ✓ | ✓ |
| Approve / reject downline requests | ✓ | ✓ | ✓ | — |
| Direct Release to downline | ✓ | ✓ | ✓ | — |
| Edit deposit rates for downlines | ✓ | ✓ | ✓ | — |
| Edit sale commission % | ✓ | own network | — | — |
| Record demo sale | — | — | — | ✓ |
| See Internet Credits earnings | ✓ | ✓ | ✓ | — |
| See Sales Commission | ✓ | ✓ | ✓ | ✓ |
| Export Reports CSVs | ✓ | ✓ | ✓ | subset |
| Reset demo / profile | ✓ | ✓ | ✓ | ✓ |

Typical demo walkthrough: Admin or Sub Direct-Releases (or approves a request) → Fran releases to Retailer → Retailer records a demo sale → Revenue/Reports show both streams for uplines and commission-only for the retailer.

---

## 6. Money math (both streams)

### Load (Internet Credits earnings)

`credits = deposit ÷ rate`

Example Fran→Retailer at 80% sell / 70% buy:

- Cash in ₱6,000 → ₱7,500 credits
- Fran cost = ₱7,500 × 70% = ₱5,250
- Fran Internet Credits earnings = ₱6,000 − ₱5,250 = **₱750**
- Same as ₱7,500 × (80% − 70%)

Admin’s Internet Credits earnings on a load are the **cash collected**, not a buy/sell spread (Admin mints).

### Sale (Sales Commission)

Demo sale on ₱1,000 customer payment:

- Credits consumed = ₱950 + ₱20 = ₱970
- Commission pool (sale margin) = ₱30
- Default stamps: retailer ₱9, franchisee ₱6, sub ₱3, platform ₱12

Retailer does **not** keep 100% of sale margin. Wallet’s “Sale Margin” card is the pool (all-time), not “Your Commission”.

---

## 7. Not in v1 / leftovers

Verified leftovers — documented so they are not treated as product:

| Item | Notes |
|------|--------|
| Reverse after release | UI off; helper still in `fundingActions.js` |
| Transfer History tab | Off; Direct Release history is on existing IC tabs |
| Dashboard / org / franchisee / retailer management | Nav stubs or placeholders |
| Buyer-submitted payment reference | Upline enters payment ref on release |
| Hold / clarification status | Reject only |
| User guide `.docx` | Regenerated 2026-08-18; screenshots may still show older sample rows |
| Transactions column **Sale Margin** | Same number as Reports **Commission pool**; naming not unified |
| Retailer Wallet “Min. ₱5,000” | Details modal no longer has a Minimum Balance card; this caption remains |
| `RevenueSharingPage` | Dead code; live config is Commission Settings |

Storage keys (all `esarisari_*`) cover users, orgs, wallets, funding requests/transfers, commission settings, deposit rates, transactions, settlements, session, notification reads, and one-time seed version stamps.
