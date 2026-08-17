# Internet Credits — Business Model Review

**Status:** Living product lock (Internet Credits + Deposit Rates built; sale distribution % restored 2026-08-17; ops updates 2026-08-18)  
**Source:** FigJam / mockups — eSarisari Internet Credits Initial Mockup  
**Last updated:** 2026-08-18

**Whole app (all modules, all roles):** [app-modules.md](./app-modules.md). This file stays the Internet Credits / deposit-rate lock.

Current v1 Internet Credits behavior is in [§11](#11-shipped-updates-2026-08-18--verified). Sections 2–8 are the original mock review; several gaps there are now closed or deferred in §11.

This document captures the finance/process review of the **token / internet credits** business model across portals, plus the later product lock that **sale commission splits run alongside deposit rates** (they are not a replacement for each other).

---

## Table of contents

1. [Business model overview](#1-business-model-overview)
2. [Admin portal](#2-admin-portal) — reviewed
3. [Subfranchisee portal](#3-subfranchisee-portal) — reviewed
4. [Franchisee portal](#4-franchisee-portal) — reviewed
5. [Retailer portal](#5-retailer-portal) — reviewed
6. [End-to-end chain summary](#6-end-to-end-chain-summary)
7. [Cross-role open questions](#7-cross-role-open-questions)
8. [Priority recommendations](#8-priority-recommendations)
9. [Decision checklist](#9-decision-checklist) — product lock (D3 restored 2026-08-17)
10. [Other pages — change impact](#10-other-pages--change-impact-current-app-vs-locked-model)
11. [Shipped updates (2026-08-18) — verified](#11-shipped-updates-2026-08-18--verified)

---

## 1. Business model overview

### Working understanding (all roles reviewed)

This is a **multi-tier prepaid float / inventory credit** model. Mid-tiers hold an **Available Credits** balance and release to downlines after verifying cash deposit + proof of payment. **Retailer is the end buyer** — request-only, no downline release tab.

| Tier hop | Who pays cash | Who releases credits | Cash as % of credit face (from mock samples) | Example |
|----------|---------------|----------------------|-----------------------------------------------|---------|
| Admin → Subfranchisee | Subfranchisee → Admin/CWPC | Admin | **60%** (Admin modal) | ₱15,000 → 25,000 credits |
| Subfranchisee → Franchisee | Franchisee → Subfranchisee | Subfranchisee (Available Credits) | **70%** | ₱3,500 → 5,000 credits |
| Franchisee → Retailer | Retailer → Franchisee | Franchisee (Available Credits) | **80%** (table) **vs 70%** (approve modal) — **conflict** | Table: ₱560 → 700 @ 80%; Modal: ₱560 → 800 @ 70% |
| Retailer (buy only) | Retailer → Franchisee | Franchisee | Sample history: ₱800 deposited → **1,000** total received (= **80%**) | Aligns with Franchisee **table** rate, not modal 70% |

Pattern: deposit rate **rises down the chain** (60 → 70 → 80), creating mid-tier cash spreads on float sales.

### Two separate pricing surfaces (locked 2026-08-17)

Deposit rates and sale splits are **both in product**. They price different events and must not be merged.

| Surface | What it prices | Where configured | Earnings it creates |
|---------|----------------|------------------|---------------------|
| **Deposit Rates** | Internet Credits **loads** (cash paid ÷ credit face) | `/deposit-rates` — hop defaults 60/70/80 + per-downline override | Admin **load cash**; Sub/Fran **credit spread** |
| **Commission Settings** | **Each internet sale** — split of sale margin | `/commission-settings` — per-retailer % (Admin + Sub-Franchisee) | Retailer / Franchisee / Sub / Platform **sale commission** |

**Sale margin** = customer payment − credits consumed. That amount is the **commission pool**, not one party’s revenue. Each tier earns its stamped % of the pool. Retailer does **not** keep 100% of sale margin.

Deposit rates do **not** replace the per-sale split. Credits consumed on a sale do **not** feed the share calculator — the split applies only after the sale.

### Correct conversion formula (any tier)

Given `deposit_rate` = cash paid ÷ credit face value:

- `credits = deposit ÷ deposit_rate`
- Display: *“X% of credit value is paid as deposit. Example: 1,000 credits = ₱(1000 × X%).”*

Use **÷**, never “deposit + X%”.

---

## 2. Admin portal

**Screen:** Internet Credits Request  
**Modal:** Add Internet Credit (Approve & release credits)

### 2.1 Current admin flow

1. Downline deposits cash and submits a request + proof of payment.
2. Admin sees request as **Pending** with deposited amount; credits may show `₱0.00` until release.
3. Summary cards show: pending cash deposits, pending credits to release, credits already released.
4. Admin clicks **Approve & release credits**.
5. Admin enters **Payment reference ID**, confirms or edits **Credits to release** (pre-filled from formula).
6. Admin saves → status **Released**; credits move to downline.

### 2.2 UI elements observed

**Summary cards**

| Card | Meaning (as labeled) |
|------|----------------------|
| Pending deposits | Total deposited but not yet released to downlines (cash) |
| Pending credits to release | Eligible to release but not yet released (credit face) |
| Credits released | Already released to downlines (credit face) |

**Table columns:** No, Date, Deposited Amount, Credits, Status, Proof of Payment, Name, Action  
**Statuses seen:** Pending, Released  
**Actions:** Search, Export CSV, View proof, Approve & release credits

**Modal fields**

- Payment reference ID (free text)
- Credits to release (editable; pre-filled suggested amount)
- Suggested credits explanation box
- Cancel / Save

### 2.3 What is already solid

- Clear separation of **cash deposited** vs **credits released**
- Proof-of-payment gate before release
- Editable suggested credits (handles exceptions)
- Export + search for ops
- Status split: Pending vs Released

### 2.4 Gaps / risks (material)

| # | Issue | Why it matters |
|---|--------|----------------|
| 1 | **Formula copy is wrong / misleading** — UI may say “₱15,000 deposited + 60% = 25,000 tokens.” `15,000 + 60%` ≠ `25,000`. | Ops and finance will miscompute loads and overrides. |
| 2 | **Bank cash ownership unclear** — no deposit destination (CWPC bank / e-wallet), matched bank txn, or deposit date vs approval date. | Weak cash reconciliation. |
| 3 | **No reject / hold / reverse path** — only Approve & release. | Cannot handle bad proof, duplicates, or mistaken release. |
| 4 | **Payment reference ID is free text** — easy to duplicate or mistype. | Audit and bank matching break. |
| 5 | **Credits amount editable without guardrails** — no reason code, permission, or min/max around suggestion. | Margin and inventory can be silently distorted. |
| 6 | **KPI cards mix units** — pending deposits = ₱ cash; pending/released credits = token face (shown with ₱). | If tokens ≠ peso 1:1 for P&L, “Credits released ₱50,000” is misread as cash revenue. |
| 7 | **Revenue recognition ambiguous** — is cash at deposit a liability (customer deposit / deferred), and only earned when credits are consumed downstream? Or recognized at admin release? | Month-end P&L will be wrong until the rule is fixed. |
| 8 | **No COGS / wholesale cost on the credit** — cash in and credits out only. | Gross margin on credit sales cannot be computed from this screen alone. |
| 9 | **Weak audit fields on the list** — missing approver, approval timestamp, suggested vs actual credits, reject reason, linked wallet credit txn ID. | Not audit-ready. |

### 2.5 Admin assumptions (to confirm with other roles)

| Assumption | Why it matters | Impact if wrong |
|------------|----------------|-----------------|
| Admin loads credits only to **Subfranchisee** first | Franchise/retailer may request via different upline | Wrong approval routing and wallet target |
| 60% cash rule is **global** for this product | Per-tier rates would change the modal calc | Wrong suggested credits |
| 1 credit face = ₱1 for display | Otherwise ₱ formatting on “Credits” is wrong | Inflated/deflated finance KPIs |
| Deposit is real cash already in company accounts | Otherwise “Pending deposits” is not a cash asset | Balance sheet misstatement |

### 2.6 Recommended admin metrics

Even if not all appear on the first mock:

- Cash collected (verified deposits)
- Credits released (face value)
- Unreleased liability (pending deposits)
- Effective cash rate (`cash ÷ credits`) vs target 60%
- Override count (suggested ≠ actual)
- Aging of pending requests
- Released but unmatched payment refs

### 2.7 Recommended admin data (for later schema work)

**Must-have fields / concepts**

- Request ID (immutable)
- Requester account ID + role (subfranchisee / franchisee / retailer)
- Deposit amount (cash)
- Suggested credits
- Actual credits released
- Status history (pending → released / rejected / held / reversed)
- Proof of payment asset reference
- Payment / bank reference ID (unique or soft-unique)
- Deposit received-at vs approved-at
- Approver user ID
- Linked wallet credit transaction ID
- Override reason (if actual ≠ suggested)

**Should-have**

- Deposit destination account
- Bank match status
- Reject / reverse reason codes
- Period / batch for month-end close

---

## 3. Subfranchisee portal

**Screen:** Internet Credits (two tabs)  
**Tabs:** Downlines Credits Request | My Credits Request

Subfranchisee is a **dual-role node**:

1. **Buyer** — requests credits from Admin (My Credits Request)
2. **Seller / releaser** — approves Franchisee deposits and releases credits from own balance (Downlines Credits Request)

---

### 3.1 Tab A — My Credits Request (buy from Admin)

#### Flow

1. Subfranchisee uses **Credit Calculator** (deposit ↔ desired credits).
2. Clicks **Submit credits request**.
3. Enters **Deposited amount (₱)** + uploads **proof of payment**.
4. Request appears in history; waits for Admin approval/release.
5. Cards show pending vs historical totals once processed.

#### UI elements observed

**Summary cards**

| Card | Meaning (as labeled) |
|------|----------------------|
| Pending deposits | Not yet approved or released; also shows total deposited (lifetime/period) |
| Pending credits to receive | Credits not yet received from upline; also shows total received credits |

**Other UI**

- Credit Calculator: Amount to deposit (₱) ↔ Desired credit amount
- Table: No, Date, Amount, Credit, Status, Proof of Payment
- Actions: Search, Submit credits request, Refresh
- Statuses seen: Approved (sample)
- Modal: Deposited amount + proof upload only (no payment reference field on submit side)

#### Sample row note

Mock sample data for this tab looks **inconsistent across frames / labels** (e.g. amount vs credit vs “total received” cards). Treat sample numbers as placeholders until product confirms the Admin→Subfranchisee rate (Admin modal says **60%** deposit rate).

---

### 3.2 Tab B — Downlines Credits Request (sell / release to Franchisee)

#### Flow

1. Franchisee deposits cash to Subfranchisee and submits request + proof (Franchisee portal — pending review).
2. Subfranchisee sees pending request with deposited amount, margin %, proof, and Franchisee name/account.
3. Summary cards include **Available Credits** (inventory on hand).
4. Subfranchisee clicks **Approve & release credits**.
5. Enters payment reference ID, confirms/edits credits to release (suggested from margin).
6. Save → credits leave Subfranchisee **Available Credits** and go to Franchisee.

#### UI elements observed

**Summary cards**

| Card | Example | Meaning |
|------|---------|---------|
| Pending deposits | ₱3,500.00 | Cash deposited by downlines, not yet released |
| Pending credits to release | ₱5,000.00 | Credit face eligible but not released |
| Credits released | ₱20,000.00 | Already released to downlines |
| Available Credits | ₱30,000.00 | Subfranchisee’s own credit inventory balance |

**Table columns:** No, Date, Deposited, Credit, **Margin**, Status, Proof, Name, Action  
**Statuses seen:** Pending, Approved  
**Margin (sample):** 70% on Franchisee rows  
**Modal:** Same pattern as Admin — Payment reference ID, Credits to release (editable), suggested calc box

#### Conversion on this hop (from modal numbers)

- Deposit ₱3,500 → suggested **5,000** credits
- Math that works: `3,500 ÷ 0.70 = 5,000` → **70% of credit face paid as cash**
- Example that matches: `1,000 credits = ₱700`

**Mock copy bugs on this modal (critical):**

| Shown copy | Problem |
|------------|---------|
| `₱3,500.00 deposited + 70% (margin rate) = 5000.00 credits` | Additive “+ 70%” does not equal 5,000 |
| `30% of credit value is paid as deposit` | Contradicts the example `1,000 credits = ₱700` (that is **70%** paid as deposit) |

Correct copy should be: *“70% of credit value is paid as deposit. 1,000 credits = ₱700. Suggested = deposit ÷ 0.70.”*

---

### 3.3 What is already solid

- Clear **two-sided** portal: buy from upline + sell to downline
- **Available Credits** makes inventory constraint visible (credits are stock, not unlimited minting at mid-tier)
- **Margin %** column on downline table (better than Admin table, which lacked it)
- Calculator on “My Credits Request” helps subfranchisee plan cash vs credits
- Same approve/release pattern as Admin → easier ops training

### 3.4 Gaps / risks (material)

| # | Issue | Why it matters |
|---|--------|----------------|
| 1 | **Tiered deposit rates** (Admin hop ~60%, Franchisee hop ~70%) are not named as a price book / rate card | Without a configured rate per hop, every portal will hardcode conflicting formulas |
| 2 | **Modal explanation text is internally contradictory** (70% math vs “30% paid as deposit”) | Guaranteed ops confusion and wrong manual overrides |
| 3 | **No visible insufficient-balance block** when Available Credits &lt; credits to release | Subfranchisee could over-release / go negative unless enforced in backend |
| 4 | **Cash stays with Subfranchisee** on Franchisee deposits (payment ref entered by Subfranchisee) | Mid-tier becomes a cash collection agent; need clarity on who owns cash, tax, and reconciliation |
| 5 | **Status vocabulary drift** — Admin used “Released”; Subfranchisee table uses “Approved” | Reporting joins and filters will break if statuses aren’t normalized |
| 6 | **My Credits sample vs Admin rate mismatch** — placeholders may show 1:1 or other ratios vs Admin’s 60% rule | Product must lock the Admin→Subfranchisee rate before build |
| 7 | **No reject / hold / reverse** on either tab (same as Admin) | Bad proof / mistakes have no path |
| 8 | **Submit modal has no payment reference** from requester side | Only upline enters ref at approve time — weaker requester-side bank matching |
| 9 | **Subfranchisee margin economics not shown** — bought at ~60% cash, sold at ~70% cash | Spread is the mid-tier profit on float; should be reportable (buy rate, sell rate, credits in/out, cash in/out) |
| 10 | **Editable credits to release** without tying to Available Credits or reason codes | Same override risk as Admin, plus inventory risk |

### 3.5 Subfranchisee economics (working model)

**Assumption:** 1 credit face = ₱1 for display.

| Event | Cash | Credits |
|-------|------|---------|
| Buy from Admin | Pay ~60% of face to Admin | Receive 100% face into Available Credits |
| Sell to Franchisee | Receive ~70% of face from Franchisee | Release 100% face from Available Credits |

Illustrative unit on 1,000 credits sold to Franchisee:

- Cash in from Franchisee: ₱700  
- Credit cost basis (what Subfranchisee paid Admin for those 1,000 credits): ₱600  
- **Gross cash spread on that float sale:** ₱100 (before any other fees/COGS)

**Why this matters:** This is mid-tier **distribution margin on prepaid inventory** — one of two Sub/Franchisee earning streams. The other is **sale commission**: their stamped % of each downline internet sale’s margin (see Commission Settings). Do not treat credit spread as a substitute for the per-sale split.

### 3.6 Recommended subfranchisee metrics

- Available credit balance (inventory)
- Credits purchased from Admin (face) + cash paid to Admin
- Credits released to Franchisees (face) + cash collected from Franchisees
- Pending deposit aging (downlines)
- Effective buy rate vs sell rate (`cash ÷ credits`)
- Inventory cover days / stockout risk (available vs pending-to-release)
- Override count (suggested ≠ actual) when releasing to downlines

### 3.7 Recommended data (additive to Admin section)

- `rate_card` / hop deposit rate (Admin→Sub, Sub→Franchise, Franchise→Retailer)
- `available_credit_balance` per account (or wallet ledger)
- Debit Available Credits on downline release (atomic with credit grant)
- Cash collection owner at mid-tier (Subfranchisee bank account vs company account)
- Status enum shared across portals (`pending`, `approved`/`released`, `rejected`, `reversed`)
- Link: Subfranchisee “My request” ↔ Admin request ID (same underlying request record)

---

## 4. Franchisee portal

**Screen:** Internet Credits (two tabs)  
**Tabs:** Retailers Credits Request | My Credits Request

Franchisee mirrors Subfranchisee’s dual role one tier down:

1. **Buyer** — requests credits from Subfranchisee / upline (My Credits Request)
2. **Seller / releaser** — approves Retailer deposits and releases credits from own **Available Credits** (Retailers Credits Request)

---

### 4.1 Tab A — My Credits Request (buy from upline)

#### Flow

1. Franchisee uses **Credit Calculator** (deposit ↔ desired credits).
2. Clicks **Submit credits request**.
3. Enters **Deposited amount (₱)** + uploads **proof of payment**.
4. Request waits for Subfranchisee approval/release.
5. Cards show pending vs historical totals.

#### UI elements observed

**Summary cards**

| Card | Example | Meaning |
|------|---------|---------|
| Pending deposits | ₱0.00 (Total deposited: ₱14,000.00) | Not yet approved/released |
| Pending credits to receive | ₱0.00 (Total received credits: ~₱20,688.00) | Not yet received from upline |

**Other UI**

- Credit Calculator: Amount to deposit ↔ Desired credit amount
- Table: No, Date, Deposited, Credits, Status, Proof of Payment
- Sample row: ₱14,000 deposited, Credits column shows **—** (dash), Status **Approved**, Proof View
- Modal: Deposited amount + proof upload only

#### Sample data notes

- Credits column blank/dash on an **Approved** row is a UX/data bug — approved requests should show released credit face.
- Total received ~₱20,688 vs ₱14,000 deposited ≈ **~67.7%** effective cash rate if face were 20,688 — does **not** cleanly match the Sub→Franchise **70%** rate (`14,000 ÷ 0.70 = 20,000`). Treat as placeholder inconsistency.

---

### 4.2 Tab B — Retailers Credits Request (sell / release to Retailer)

#### Flow

1. Retailer deposits cash to Franchisee and submits request + proof (Retailer portal — pending).
2. Franchisee sees pending request with deposit, credits, **Margin**, proof, retailer name/account.
3. Summary includes **Available Credits**.
4. Franchisee clicks **Approve & release credits**.
5. Enters payment reference ID + confirms/edits **Amount to release**.
6. Save → credits leave Franchisee Available Credits → Retailer.

#### UI elements observed

**Summary cards**

| Card | Example | Meaning |
|------|---------|---------|
| Pending deposits | ₱560.00 | Requested/deposited, not yet released to retailers |
| Pending credits to release | ₱700.00 | Eligible credit face not yet released |
| Credits released | ₱1,000.00 | Already released to retailers |
| Available Credits | ₱19,000.00 | Franchisee credit inventory |

**Table samples**

| Deposited | Credits (table) | Margin (table) | Status | Math check |
|-----------|-----------------|----------------|--------|------------|
| ₱560.00 | ₱700.00 | **80%** | Pending | `560 ÷ 0.80 = 700` ✓ |
| ₱800.00 | ₱1,000.00 | **80%** | Approved | `800 ÷ 0.80 = 1,000` ✓ |

**Approve modal (same pending ₱560 row)**

| Field / copy | Value | Problem |
|--------------|-------|---------|
| Amount to release (pre-fill) | **800** | Does not match table Credits **700** |
| Formula | `₱560 ÷ 70% = 800 tokens` | Uses **70%**, not table **80%** |
| Explanation | “70% of credit value used as deposit. 1,000 credits = ₱700” | Consistent with 70%, inconsistent with table 80% |

This is the **highest-severity rate conflict** so far: same request shows **80% → 700** in the list and **70% → 800** in the modal.

Also note naming drift: modal field is **Amount to release** (elsewhere **Credits to release**).

---

### 4.3 What is already solid

- Same dual-tab pattern as Subfranchisee → easy training across tiers
- **Available Credits** inventory visibility for Franchisee→Retailer releases
- **Margin** column on retailer table
- Approve modal formula uses **÷** (correct operator) in this mock
- Calculator on My Credits Request
- Disabled/grey action on already Approved rows (better than leaving an active approve button)

### 4.4 Gaps / risks (material)

| # | Issue | Why it matters |
|---|--------|----------------|
| 1 | **70% vs 80% conflict** on Franchisee→Retailer hop (modal vs table/cards) | Wrong releases, wrong retailer pricing, broken trust in calculator |
| 2 | **Suggested amount 800 ≠ table credit 700 ≠ pending-credits card 700** | Three UIs, two answers — must pick one rate card |
| 3 | **Approved My Credits row with Credits = —** | Incomplete history; franchisee can’t reconcile what they received |
| 4 | **Total received ₱20,688 vs expected ₱20,000 at 70%** on ₱14,000 deposit | Placeholder math or silent overrides already assumed |
| 5 | Same inventory / override / reject / payment-ref risks as Subfranchisee | Over-release, weak audit, mid-tier cash custody |
| 6 | Field label **Amount to release** vs **Credits to release** | Ambiguous if amount means cash or credits |
| 7 | Franchisee economics depend on locked buy rate (from Sub) vs sell rate (to Retailer) | If buy @70% and sell @80%, spread is **10pts**; if sell accidentally @70%, **zero spread** |

### 4.5 Franchisee economics (working model)

**Assumption:** 1 credit face = ₱1 for display.

| Event | Cash | Credits |
|-------|------|---------|
| Buy from Subfranchisee | Pay ~70% of face | Receive 100% face into Available Credits |
| Sell to Retailer | Receive **80%** of face *(if table is correct)* | Release 100% face from Available Credits |

Illustrative unit on 1,000 credits sold to Retailer @ **80%**:

- Cash in from Retailer: ₱800  
- Credit cost basis (paid to Sub @ 70%): ₱700  
- **Gross cash spread:** ₱100  

If modal **70%** sell rate were used instead:

- Cash in: ₱700  
- Cost basis: ₱700  
- **Gross cash spread: ₱0** — franchisee only moves inventory for free (plus ops burden)

**Product must lock Franchisee→Retailer deposit rate before build.**

### 4.6 Recommended franchisee metrics

- Available credit balance
- Credits purchased from upline + cash paid
- Credits released to retailers + cash collected
- Effective buy rate vs sell rate
- Pending retailer deposit aging
- Override count (suggested ≠ table/rate-card amount)
- Stockout risk: available vs pending-to-release

### 4.7 Recommended data (additive)

- Same shared request model as Subfranchisee, with `requester_role = franchisee|retailer` and `approver_role = subfranchisee|franchisee`
- Single `deposit_rate` stored **on the request at submit time** (snapshot), so table/modal/cards never disagree
- Display Credits on My Credits history after approval (never dash if Approved/Released)
- Normalize field label to **Credits to release** everywhere

---

## 5. Retailer portal

**Screen:** Internet Credits (single view — no downline tab)  
**Role:** End-of-chain **buyer only** — requests credits from Franchisee; does not approve/release to anyone below.

---

### 5.1 Flow

1. Retailer uses **Credit Calculator** (deposit ↔ desired credits).
2. Clicks **Submit credits request**.
3. Enters **Deposited amount (₱)** + uploads **proof of payment**.
4. Franchisee reviews on **Retailers Credits Request** and releases from Franchisee Available Credits.
5. Retailer sees status / Available Credits on their Internet Credits page.

### 5.2 UI elements observed

**Summary cards**

| Card | Example | Meaning |
|------|---------|---------|
| Pending deposits | ₱0.00 (Total deposited: ₱800.00) | Not yet approved/released |
| Pending credits to receive | ₱0.00 (Total received: ₱1,000.00) | Not yet received from franchisee |
| Credit calculator | deposit ↔ desired credits | Conversion helper |

**Other UI**

- Single list: **My credits requests** (no “Downlines” / “Retailers” tab — correct for end node)
- **Available Credits: 1000 credits** shown beside table header (inventory/balance after loads)
- Table: No, Date, Deposited, Credits, Status, Proof of Payment
- Sample row: ₱800 deposited, Credits **—**, Status **Approved**, Proof View
- Modal: Deposited amount + proof upload (Cancel / Submit)
- Copy explicitly says credits come **from franchisee** / franchise

### 5.3 Rate check vs Franchisee hop

| Signal | Implied deposit rate |
|--------|----------------------|
| Total deposited ₱800 + Total received ₱1,000 | `800 ÷ 1,000 = **80%**` |
| Franchisee retailer table Margin | **80%** |
| Franchisee approve modal | **70%** (conflict — see §4) |

Retailer history **supports 80%** as the intended Franchisee→Retailer rate.

### 5.4 What is already solid

- Correct end-node UX: buy/request only, no release actions
- Clear upline wording (“from franchisee”)
- Calculator + proof-of-payment same pattern as other buyer tabs
- Available Credits visible on the page (retailer knows float on hand)

### 5.5 Gaps / risks (material)

| # | Issue | Why it matters |
|---|--------|----------------|
| 1 | **Approved row with Credits = —** (same bug as Franchisee My Credits) | Retailer can’t see what was credited per request |
| 2 | Calculator rate not shown (no “your rate is 80%” label) | Retailer may not understand why ₱800 → 1,000 credits |
| 3 | No payment reference on submit (only upline enters it later) | Weaker requester-side bank matching |
| 4 | No reject / cancelled visibility path if Franchisee rejects | Retailer stuck not knowing why pending forever |
| 5 | Available Credits shown as “1000 credits” while other portals use ₱ formatting | Unit/label inconsistency across roles |
| 6 | No spend / usage view on this screen | Unclear how retailer consumes credits (internet sales?) — needed for full P&L |

### 5.6 Retailer economics (working model)

**Assumption:** buy @ **80%** of face from Franchisee; 1 credit face = ₱1.

| Event | Cash | Credits |
|-------|------|---------|
| Buy from Franchisee | Pay ₱800 for 1,000 credits | Receive 1,000 into Available Credits |
| Sell / use downstream | TBD (customer internet top-up / plan sale) | Debit Available Credits |

On an internet sale, credits are consumed and **sale margin** (`customer payment − credits consumed`) becomes the commission pool. The retailer’s earning is **their distribution % of that pool**, not the full margin. Uplines take the remaining shares (see D3).

### 5.7 Recommended retailer metrics / data

- Available credit balance
- Cash paid to Franchisee vs credits received (effective rate)
- Pending request aging
- Credits consumed / sold (once usage exists)
- Sale commission (retailer % of sale margin), distinct from full sale margin / commission pool
- Link My request ↔ Franchisee Retailers Credits Request ID
- Always show Credits face on Approved rows

---

## 6. End-to-end chain summary

```text
Admin (CWPC)
  │  cash in @ ~60% of face  →  credits out
  ▼
Subfranchisee  [holds Available Credits]
  │  cash in @ ~70% of face  →  credits out from stock
  ▼
Franchisee     [holds Available Credits]
  │  cash in @ ~80% of face  →  credits out from stock   ★ lock rate (mock conflict 70 vs 80)
  ▼
Retailer       [holds Available Credits — buyer only]
  │  uses/sells credits to end customers (not in these mocks)
  ▼
End customer
```

### Illustrative unit economics (1,000 credits moving down; assume locked 60/70/80)

| Hop | Cash collected by upline | Credit face released | Upline cash spread vs their buy cost |
|-----|--------------------------|----------------------|--------------------------------------|
| Admin ← Sub | ₱600 | 1,000 | Platform float: ₱600 cash for 1,000 face (40% unrealized until downstream rules defined) |
| Sub ← Franchisee | ₱700 | 1,000 | Sub spread vs Admin cost ₱600 → **₱100** |
| Franchisee ← Retailer | ₱800 | 1,000 | Franchisee spread vs Sub cost ₱700 → **₱100** |
| Retailer | paid ₱800 | holds 1,000 | On sale: consumes credits; earns **their %** of (customer payment − credits consumed). Remaining % goes upline. |

### Shared UX pattern (all portals)

| Pattern | Admin | Sub | Franchisee | Retailer |
|---------|-------|-----|------------|----------|
| Buy / request from upline | — | My Credits Request | My Credits Request | Internet Credits (only view) |
| Approve / release to downline | Internet Credits Request | Downlines Credits Request | Retailers Credits Request | — |
| Available Credits inventory | (mints/releases) | Yes | Yes | Yes (balance only) |
| Proof of payment | View + approve | Both sides | Both sides | Submit + view |
| Calculator on buy side | — | Yes | Yes | Yes |

---

## 7. Cross-role open questions

| # | Question | Status after full review |
|---|----------|--------------------------|
| 1 | Who deposits cash to whom? | **Resolved in mocks:** Sub→Admin; Fran→Sub; Retailer→Fran. |
| 2 | Global vs tiered deposit %? | **Tiered.** Working card **60 / 70 / 80**. Fran→Retailer modal still wrongly shows 70. |
| 3 | Who holds float? | **Resolved:** Sub, Franchisee, Retailer hold Available Credits; only Admin “creates” on approve. |
| 4 | Revenue recognition timing? | **Open** — deposit vs release vs end-customer consumption. |
| 5 | Link to 40/60 transaction share? | **Locked — keep both, keep separate.** Deposit rates price credit loads. Distribution % splits sale margin on each internet sale. Credits do not feed the share calc. |
| 6 | Credits = inventory float? | **Yes** from mocks; confirm usage/debit events. |
| 7 | Pure credit transfer without cash? | **Open** — not in mocks. |
| 8 | Mid-tier cash ownership / tax? | **Open** for Sub + Franchisee collectors. |
| 9 | Authoritative Fran→Retailer rate? | **Decide 80%** (table + retailer totals) vs fix modal. |
| 10 | How does Retailer consume credits? | **Open** — no usage/sales mock in this set. |

---

## 8. Priority recommendations

### Critical

- Lock tier rate card: **Admin 60% / Sub→Fran 70% / Fran→Retailer 80%** (or explicit product alternative).
- Fix Franchisee approve modal (70% / 800) to match table (80% / 700).
- Snapshot `deposit_rate` on each request so list/modal/cards never diverge.
- Standardize formula copy: `credits = deposit ÷ deposit_rate` on all portals.
- Fix Subfranchisee modal “30% vs 70%” contradiction.
- Enforce Available Credits ≥ release amount on Sub + Franchisee approve.
- Show Credits face on all Approved buyer rows (Sub/Fran/Retailer — no dash).
- Normalize statuses (`Approved` vs `Released`) and labels (`Credits to release`).
- Add reject / hold / reverse paths.
- Payment reference uniqueness / bank match rules.
- Define revenue recognition + mid-tier cash custody for finance.
- Keep **Deposit Rates** and **Commission Settings** as two nav surfaces; never redirect one to the other.
- On Revenue / Reports / Transactions: report **credit-load earnings** and **sale commission** as separate totals. Do not label full sale margin as retailer revenue.

### Should have

- Show deposit rate on calculator (“Your rate: 80%”).
- Override reason + audit fields on every release.
- Per-tier P&amp;L: cash up vs cash down vs credits in/out.
- Shared request IDs across buyer ↔ upline queues.
- Consistent credit unit display (credits vs ₱ face).

### Nice to have

- Pending aging, override analytics, insufficient-balance warnings.
- Retailer usage / end-customer sale flow (needed for full margin).
- COGS linkage for true gross margin.

---

## 9. Decision checklist

Use this to lock product/finance rules. Deposit-rate items (A–C, D1–D2, D4) remain as originally locked. **D3 was reopened 2026-08-17** — sale distribution % is back in product.

### A. Rate card (must lock)

- [ ] **A1** Admin → Sub deposit rate
  - [x] 60% *(recommended — Admin modal)*
  - [ ] Other: ___
- [ ] **A2** Sub → Franchisee deposit rate
  - [x] 70% *(recommended)*
  - [ ] Other: ___
- [ ] **A3** Franchisee → Retailer deposit rate
  - [x] 80% *(recommended — table + retailer ₱800→1,000; fix modal)*
  - [ ] 70%
  - [ ] Other: ___
- [ ] **A4** Are rates global per hop or configurable per account?
  - [ ] Global hop defaults only
  - [ ] Per-account override only
  - [x] Both — global defaults + rare override with reason *(recommended)*
- [ ] **A5** Snapshot rate on request submit?
  - [x] Yes — immutable on request *(recommended)*
  - [ ] No — always use live rate

**Formula (locked wording):** `credits = deposit ÷ deposit_rate`  
Example at 80%: ₱800 deposit → 1,000 credits. Never “deposit + X%”.

---

### B. Money & inventory rules

- [ ] **B1** 1 credit face display = ₱1?
  - [x] Yes for v1 *(recommended)*
  - [ ] No — stop using ₱ on credit columns; unit: ___
- [ ] **B2** Can mid-tier release without enough Available Credits?
  - [x] Block *(recommended)*
  - [ ] Allow negative
  - [ ] Allow with Admin override
- [ ] **B3** Can Admin mint freely (no prior inventory)?
  - [x] Yes *(recommended — Admin is source of credits)*
  - [ ] No
- [ ] **B4** Pure credit transfer downline **without** new cash?
  - [x] Allowed as **Direct Release** — same deposit ÷ rate as a request, no pending queue
  - [ ] 1:1 cashless inventory move *(not used)*
- [ ] **B5** Who owns mid-tier collected cash (Sub/Fran bank)?
  - [x] Partner’s own account
  - [ ] Company collection account
- [ ] **B6** Editable credits on approve?
  - [x] Free edit
  - [ ] Edit within ±X% + mandatory reason *(recommended)* — X% = ___
  - [ ] No edit

---

### C. Statuses & workflow

- [ ] **C1** Canonical status enum
  - [x] `pending` / `released` / `rejected` / `reversed` — UI “Approved” = `released` *(recommended)*
  - [ ] `pending` / `approved` / `rejected` / `reversed`
  - [ ] Other: ___
- [ ] **C2** Reject path?
  - [x] Yes + reason *(recommended)*
  - [ ] No
- [ ] **C3** Reverse after release?
  - [ ] Yes — Admin only + reason *(recommended for v1)*
  - [ ] Yes — any upline
  - [x] No in v1 *(UI removed 2026-08-18; clawback helper still in code, unused)*
- [ ] **C4** Hold / clarification status?
  - [ ] Yes
  - [x] No in v1 *(recommended — reject is enough)*
- [ ] **C5** Payment reference required to release?
  - [x] Required + unique soft-warn on duplicate *(recommended)*
  - [ ] Required unique (hard block)
  - [ ] Optional
- [ ] **C6** Buyer submits payment ref too?
  - [ ] Yes
  - [x] No — upline only; buyer optional later *(recommended for v1)*

---

### D. Finance recognition (must lock with finance)

- [ ] **D1** When does **platform** recognize revenue on credit load?
  - [ ] At Sub deposit
  - [x] At Admin release
  - [ ] As credits consumed downstream
  - [ ] Deferred until end-customer sale
  - [ ] TBD — finance sign-off *(do not treat “Credits released ₱” as cash revenue by default)*
- [ ] **D2** Mid-tier spread (e.g. buy 70% / sell 80%) — accounting treatment?
  - [ ] Partner income outside books
  - [ ] Recorded platform fee
  - [x] Ops report in app v1; ledger with finance *(recommended minimum)*
  - [ ] Not tracked in app v1
- [x] **D3** Relation to existing **40/60 transaction share**?
  - [x] **Fully separate** — deposit rates price credit loads; distribution % splits sale margin on each internet sale. Commission Settings stays in nav (Admin + Sub-Franchisee). Credits do **not** feed the share calc. *(locked 2026-08-17)*
  - [ ] Credits feed into share calc
  - [ ] Retired — not part of credit economics; Commission Settings removed from nav
  - [ ] TBD
- [ ] **D4** Retailer credit consumption event for P&L?
  - [x] Internet sale
  - [ ] Plan activation
  - [ ] Manual debit
  - [ ] TBD — schedule follow-on mock *(recommended for now)*

---

### E. UX consistency (quick yes/no)

- [x] **E1** Always show Credits face on Approved/Released buyer rows (never —) — *recommended Yes*
- [x] **E2** Show “Your deposit rate: X%” on calculators — *recommended Yes*
- [x] **E3** Same field label everywhere: **Credits to release** (not “Amount to release”) — *recommended Yes*
- [x] **E4** Insufficient-balance warning before approve modal — *recommended Yes*
- [ ] **E5** Export CSV on mid-tier portals (not only Admin)?
  - [ ] Yes — Sub + Franchisee
  - [ ] Admin only
  - [x] Decide later

---

### Suggested default lock (if product wants a one-liner)

> Tier deposit rates **60% / 70% / 80%**; snapshot on submit *(live rate reapplied if the requester updates a still-pending request)*; `credits = deposit ÷ rate`; Admin mints; Sub/Fran release from Available Credits; Direct Release is the same load (deposit ÷ rate, proof, payment ref) without a pending queue — history lives on **My Credits Request** and **Released / History** (no Transfer History tab); statuses `pending|released|rejected` in the UI (`reversed` unused); reject+reason required; payment ref required on release; requester may **update or delete** while pending; **two earnings streams** — (1) **Internet Credits earnings** (Admin load cash + mid-tier credit spread from deposit rates), (2) **Sales Commission** from distribution % of the commission pool (`customer payment − credits consumed`).

- [ ] Accept suggested default lock as-is *(superseded — D3 restored)*
- [x] Accept with exceptions noted below: **D3 reversed 2026-08-17** — sale distribution % is in product again; deposit rates stay as-is.

---

## 10. Other pages — change impact (current app vs locked model)

**Context:** Locked model is **tiered deposit → credit face** (`credits = deposit ÷ rate`) with inventory (**Available Credits**), **plus** per-sale **distribution %** (D3 restored). Revenue/Reports track both: load cash / credit spread **and** sale commission. Sale margin is the commission pool, not a single-role earning.

### 10.1 Impact map

| Priority | Page / area | Current | Needed for locked Internet Credits |
|----------|-------------|---------|-------------------------------------|
| P0 | **Internet Credits** (`/funding`, `/request-funding`) | Incoming / Mine / Released-History | Buy tab + downline approve tab; deposit vs credits; calculator; payment ref; statuses `pending/released/rejected`; **no Reverse in UI**; block short balance |
| P0 | **Direct Release** (in funding) | Upline-initiated load | **Enabled** for Admin / Sub / Franchisee — same deposit ÷ rate, proof, and payment ref as a request; skips the pending queue; listed on existing tabs with Type = Direct Release |
| P0 | **New request / Approve dialogs** | Amount + proof; approve/reject | Deposit + proof on submit; approve: payment ref + editable credits + suggested formula + rate snapshot; reject reason |
| P0 | **Data model** (`FundingRequest` / transfer / wallet) | Single `amount` | Split `depositAmount`, `suggestedCredits`, `creditsReleased`, `depositRate`, `paymentReferenceId`, override reason; credit balance vs cash |
| P1 | **Wallets** (`/wallets`, `/wallet-management`, `/wallet`) | Operating / revenue / master balances | Clarify **Available Credits** vs operating/revenue wallets; show credit inventory; activity from credit release/consume; stop treating funding approve as plain 1:1 peso transfer (or dual-post cash vs credits) |
| P1 | **Transactions** | `walletDeduction` from operating float | **D4:** internet sale **burns retailer Available Credits**; show Credits Consumed + Sale Margin **and** Your Share / 4-tier distribution % |
| P1 | **Reports** | Funding CSV/KPIs treat amount as cash=credits | Hero = **Internet Credits earnings** (links to Revenue, same period) + **Sales Commission** + **Total earnings** + sales volume; **Internet Credits by downline** rollup (not a copy of Revenue’s line-item table); commission tables use **Commission pool**; CSVs include share % and Your Share |
| P2 | **Revenue** | Dual ledger | Keep Deposit Rates stream (Admin load cash; Sub/Fran credit spread) **and** Sales Commission stream (each role’s % of sale margin). Combined earnings = both. Retailer primary KPI = commission share, not full margin. |
| P2 | **Commission Settings** | Per-retailer transaction % shares | **In nav** for Admin + Sub-Franchisee. Separate from Deposit Rates. Snapshot % onto each sale. |
| P2 | **Deposit Rates** | Rate card | Global 60/70/80 + per-downline override — pricing for **credit loads only** (unchanged) |
| P3 | **Dashboard** (currently disabled in nav) | Pending funding counts | If re-enabled: pending deposits, pending credits, Available Credits, not 1:1 funding totals |
| P3 | **Nav / copy** | “Token Credits” | Align to **Internet Credits** (mock) everywhere; field **Credits to release** (E3); keep Deposit Rates and Commission Settings as sibling items |
| P3 | **Seed / demo data** | 1:1 funding samples | Reseed with deposit/credits/rate examples per hop; keep per-retailer commission stamps on sales |
| Later | **Retailer internet sale UX** | Partial via Transactions | Ensure sale flow explicitly consumes credits and supports retailer P&L (D4) + stamped distribution % |

### 10.2 What to change on each existing surface

#### Token Credits / Funding workspace
- Rename tabs to match role mocks (e.g. Downlines / My Credits; Retailers / My Credits).
- KPIs: pending deposits (₱), pending credits, credits released, **Available Credits** (mid-tier).
- Table: Deposited, Credits, Margin %, Status, Proof, Name, Action.
- Do **not** use a separate Transfer History tab. Direct Release and approved requests both appear on **Released / History** (upline) and **My Credits Request** (downline), with a **Type** column (`Request` vs `Direct Release`).
- New Credits Request and Direct Release share deposit ÷ rate; Direct Release skips the pending request.
- Status vocabulary: map UI “Approved” → stored `released`.

#### Wallets pages
- Decide product rule: is **Available Credits** the operating wallet renamed, a new wallet type, or a separate balance field?
- Recommendation for v1: add `creditBalance` (or walletType `credits`) distinct from revenue wallet; funding release credits **that** balance; internet sale debits it.
- Direct Release from Internet Credits: allowed in v1 — same economics as a request, no pending queue.

#### Transactions
- On internet sale: debit retailer credits (D4).
- Transaction detail: show credits consumed + customer payment + sale margin **and** the 4-tier commission distribution (entity, %, amount).
- Table / CSV: keep Sale Margin (the pool) and add **Your Share**.

#### Revenue + Deposit Rates + Commission Settings
- Deposit Rates = pricing for credit loads (60/70/80 + overrides). Unchanged.
- Commission Settings = per-retailer sale splits (Admin + Sub-Franchisee). Do not redirect to Deposit Rates.
- Revenue page: **Internet Credits earnings** table (load cash / spread) **plus** Sales Commission table (viewer’s % of the commission pool). Combined earnings = both streams. Retailer KPI = commission share, not full sale margin.

#### Reports
- KPIs: **Internet Credits earnings** + **Sales Commission** + **Total earnings** + sales volume.
- Internet Credits earnings **card links to Revenue** with the same period (`?range=` + `#internet-credits`). Do **not** copy Revenue’s per-release table (with ⓘ) onto Reports.
- **Internet Credits by downline** rollup on Reports: downline, cash in, credits, earnings (Admin / Sub / Fran). Line items stay on Revenue.
- Commission tables use **Commission pool** (sale margin), not “% of yours”.
- Exports: Transactions (commission pool), Sales Commission (pool + share % + your commission), Internet Credits earnings, Internet Credits requests (includes Type), Internet Credits releases.

### 10.3 Explicit non-goals for v1 (from checklist)
- Hold/clarification status (C4)
- Reverse after release in the UI (C3) — clawback helper remains unused
- Buyer-submitted payment reference (C6)
- Merging credit loads into the sale commission share engine (keep D3 **separate** — deposit rates do not feed the split)
- Full accounting ledger for mid-tier spread (D2 = ops report only)

### 10.4 Suggested build order
1. Rate card defaults + per-account override storage (A1–A5)
2. Extend funding request/transfer model + seed
3. Rebuild Token Credits UI (request + approve) per role
4. Wire Available Credits balance + block on short release (B2, E4)
5. Direct Release (same as request + approve, no pending queue)
6. Transactions: burn credits on internet sale (D4) **and** show stamped distribution %
7. Reports/KPIs split cash vs credits + mid-tier spread ops view (D2) **and** sales commission
8. Copy/nav rename + calculator rate label (E1–E3); keep Commission Settings beside Deposit Rates

---

## 11. Shipped updates (2026-08-18) — verified

Checked against the current app (`src/lib`, `src/pages`, `src/services`, `src/data/seed.js`). This is the v1 product as of 2026-08-18.

### 11.1 Demo network

| Login | Org | Parent | Opening Available Credits |
|---|---|---|---|
| `admin@esarisari.local` (restricted) | Platform | — | ₱500,000 |
| `subfranchisee@esarisari.local` | Northern Mindanao Sub-Franchisee | Platform | ₱135,000 |
| `franchisee-a@esarisari.local` | Franchisee A | Sub | ₱0 |
| `franchisee-b@esarisari.local` | Franchisee B | Sub | ₱0 |
| `retailer-a@esarisari.local` | Retailer A (`RT-00001`) | Franchisee A | ₱0 |
| `retailer-b@esarisari.local` | Retailer B (`RT-00002`) | Franchisee A | ₱0 |
| `retailer-c@esarisari.local` | Retailer C (`RT-00003`) | Franchisee B | ₱0 |

Non-admin password: `password123`. Franchisees and retailers start empty so they must request or receive a Direct Release. Admin and Sub keep mock opening float so they can release.

Low-balance threshold is still ₱5,000 internally (notifications). The **Minimum Balance** card was removed from the wallet details modal.

The header bell also alerts the **direct upline** when a downline submits a pending Internet Credits request (deposit + suggested credits). Direct Release does not notify. Clicking opens Internet Credits. The alert clears when the request leaves pending (released / rejected / deleted); updating a pending request marks it unread again.

### 11.2 Internet Credits workspace

**Roles that can Direct Release:** Admin, Sub-Franchisee, Franchisee. Retailer is request-only.

| Tab | Who sees it | What it lists |
|---|---|---|
| Incoming (Downlines / Retailers Credits Request) | Upline | **Pending requests only** — Direct Release never queues here |
| My Credits Request | Requester / recipient | Own requests **and** Direct Releases received |
| Released / History | Both sides | Released (and rejected) requests **and** Direct Releases |

No **Transfer History** tab. Direct Release creates a funding row with `directTransfer: true`, then releases immediately (same `credits = deposit ÷ rate`, optional proof, payment ref required). Type badge: **Request** vs **Direct Release**.

**Pending requester actions:** Update (amount, notes, proof) and Delete. Both blocked once status is not pending. Update re-reads the **live** deposit rate (not the original snapshot).

**Reverse:** Hidden in the UI. `reverseInternetCredits` still exists in code but is unused.

**Approve:** Still requires payment reference; Sub/Fran cannot release more than Available Credits; Admin mints.

### 11.3 Two earnings streams (copy lock)

Do **not** call the deposit-rate spread “Load earnings”. Use **Internet Credits earnings** so it matches the Internet Credits page.

| Stream | Event | Formula | Where |
|---|---|---|---|
| **Internet Credits earnings** | Upline releases credits to a downline (request or Direct Release) | Admin: cash collected. Sub/Fran: `cash in − (credits × viewer buy rate)` = `credits × (sell rate − buy rate)` | Revenue **line-item** table + ⓘ; Reports **KPI** (links to Revenue, same period) + **by-downline rollup** + CSV |
| **Sales Commission** | Retailer sells internet to a customer | Viewer’s % of **commission pool** (`customer payment − credits consumed`) | Revenue Sales Commission table; Reports tables + CSV |
| **Total earnings** | Both | Internet Credits earnings + Sales Commission | Revenue and Reports KPI cards (not Retailer) |

Worked Sub/Fran example (Franchisee selling to Retailer at 80%, buying from Sub at 70%):

- Cash in ₱6,000 for ₱7,500 credits
- Cost = ₱7,500 × 70% = ₱5,250
- Internet Credits earnings = ₱6,000 − ₱5,250 = ₱750
- Same as ₱7,500 × (80% − 70%) = ₱750
- This is inventory markup from deposit rates, **not** sale commission

Reports **Retailer / Franchisee Commissions** tables use **Commission pool**, aligned with Revenue. “% of yours” was removed (it was share-of-viewer-total, not a commission rate).

Reports card order: Internet Credits earnings → Sales Commission → Total earnings → Sales Volume.

**Reports vs Revenue for Internet Credits (locked 2026-08-18):**

- Revenue = per-release ledger (date, reference, downline, cash in, credits, earnings + ⓘ).
- Reports = period snapshot. The Internet Credits earnings card opens Revenue at `#internet-credits` with `?range=` (and `from`/`to` if custom) so the period matches.
- Reports also shows **Internet Credits by downline** (rollup of those same entries). Not a copy of the Revenue table. Retailer does not see this block.

### 11.4 Exports (Reports)

| Card | CSV contents |
|---|---|
| Transactions | Payment, credits consumed, **Commission pool**, split %, your share |
| Sales Commission | Date, retailer, **Commission pool**, **Your share %**, your commission, status |
| Internet Credits earnings | Date, downline, cash in, credits, earnings, buy/sell rate, cost basis (Admin / Sub / Fran only) |
| Internet Credits Requests | Includes **Type** (Request vs Direct Release), deposit, credits, rate, payment ref, status |
| Internet Credits Releases | Credit-release ledger (deposit, rate, payment ref) |

### 11.5 Double-check notes (left as-is on purpose)

| Item | Status |
|---|---|
| User guide `.docx` | Regenerated 2026-08-18 from `docs/_generate_user_guide.py`. Screenshots are layout references and may show older sample rows. |
| Reverse clawback | Code remains; UI off |
| Direct Release Transfer History tab | Still off; history is on existing tabs |
| A5 rate snapshot | Submit snapshots the rate; **Update pending** reapplies the live rate |
| Wallet `minimumBalance` | Still ₱5,000 for low-balance alerts; not shown on the details modal |
| Revenue vs Reports transactions table | Reports transactions header is **Commission pool**; the standalone Transactions page may still say Sale Margin (same number) |
| Revenue Internet Credits table on Reports | Not copied. Reports uses KPI → Revenue link + by-downline rollup |
| Sections 2–5 of this MD | Original mock gaps (bank matching, override reason codes, etc.) — not all closed in v1 |

---

## Source artifacts

- FigJam: [eSarisari Internet Credits Initial Mockup](https://www.figma.com/board/bldr5TqWLzusJfH35nZBd1/eSarisari-Internet-Credits-Initial-Mockup?node-id=1-71)
- Admin, Subfranchisee, Franchisee, Retailer screenshots (workspace attachments)
- Related architecture PDF: `esarisari_onboarding_reporting_workflow.pdf` (40/60-style transaction split). **Still in product** as Commission Settings / per-sale distribution %; it is **separate from** Internet Credits deposit-rate economics.
