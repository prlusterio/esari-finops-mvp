# Sale commission baseline (3% pool) — revert notes

**Status:** Snapshot of the **previous** internet-sale commission model (3% pool). Live app as of 1 September 2026 uses **% of sales** instead — see [app-modules.md](./app-modules.md) §4.4 and §6.  
**Use this file to revert** if the sheet-aligned payout should be undone.  
**Date:** 1 September 2026  
**Repo:** `esari-finops-mvp`  
**Do not treat this file as the live product spec after a payout-model change.** Restore from here if the sheet config needs to be undone.

Related live maps:

- [App & modules](./app-modules.md) §4.4 Commission Settings, §4.5 Transactions, §6 Money math
- [Internet Credits business model review](./internet-credits-business-model-review.md)
- Internet Credits User Guide (`docs/user-guide.html` / generator) — **do not mix** load economics with this sale-pool model
- Admin User Guide — franchise setup collections are a **third** stream; not this sheet

---

## 1. Why this file exists

The client sample **REVENUE SHARING SUB-FRANCHISEE** applies:

- Sub-Franchisee **30% of Sales**
- Franchisee **20% of Sales**
- Retailer **10% of Sales**
- **Total Revenue** = 60% of Sales
- No Internet Credits / credits-consumed column
- No platform column (implied leftover would be 40% of Sales if the four parties must sum to 100% of GMV)

The app **at snapshot time** did **not** do that. It burned ~**97%** of the customer payment as Internet Credits, then split the remaining **~3% commission pool** using Commission Settings. Live app now applies Commission Settings % to **sales**; keep this file only as a revert recipe.

If we later “remove the 3% default and follow the sheet,” use this document to put the pool model back.

---

## 2. Current model (restore target)

### 2.1 Two money events (unchanged by this snapshot)

| Event | What it prices |
|-------|----------------|
| Internet Credits **load** | Deposit rates (credits = deposit ÷ rate). Not sale commission. |
| Internet **sale** | Credits burned from retailer Available Credits. Commission Settings split the **commission pool**, not gross sales. |

Franchise setup collections (Dashboard / Clients / Admin ledger pages) are a separate localStorage ledger. They are out of scope for this sheet.

### 2.2 Sale cost mix (creates the 3% pool)

Source: [`src/lib/transactions.js`](../src/lib/transactions.js) — `DEMO_SALE_BASE_COST_RATE`, `DEMO_SALE_PROCESSING_FEE_RATE`, `estimateDemoSaleCosts`.

```
credits consumed = round(payment × 0.95) + round(payment × 0.02)   → ~97% of payment
commission pool  = payment − credits consumed                     → ~3% of payment
```

Constants:

```js
DEMO_SALE_BASE_COST_RATE = 0.95        // product / load cost
DEMO_SALE_PROCESSING_FEE_RATE = 0.02   // processing
```

Callers that must stay in sync:

| File | Role |
|------|------|
| `src/lib/transactions.js` | Formula + `getTransactionCostBreakdown` (pool = payment − wallet deduction) |
| `src/services/transactionActions.js` | Record demo sale: burns credits, stamps pool + % |
| `src/components/shared/DummyTransactionDialog.jsx` | Preview before save |
| `src/lib/commission.js` | `buildCommissionPreview(..., samplePayment = 100, sampleDeduction = 97)` |
| `src/lib/wallets.js` | Retailer wallet Sale Margin = all-time pool, not take-home |
| `src/lib/revenue.js` / `src/lib/reports.js` | Sales Commission KPIs and CSVs use `distributable` / sale margin |

Sale is **blocked** if Available Credits < credits consumed.

### 2.3 Default commission stamps (of the pool, not of sales)

Source: `DEFAULT_SHARE_PERCENTAGES` in `src/lib/transactions.js`, re-exported as `DEFAULT_COMMISSION_SHARES` in `src/lib/commission.js`.

| Party | Default % of **commission pool** |
|-------|----------------------------------|
| Retailer | 30 |
| Franchisee | 20 |
| Sub-Franchisee | 10 |
| Platform (company) | 40 |
| **Total** | **100** |

Platform fee is **fixed at 40%** in the Commission Settings dialog (`DEFAULT_PLATFORM_FEE_PERCENTAGE`). Sub-Franchisee (or “Your share” for Sub users) is the **remainder**:

```
sub% = 100 − retailer% − franchisee% − platform%
```

If there is no sub in the chain (`DIRECT_TO_ADMIN`), remainder goes to platform instead.

These % are **stamped on each completed sale**. Editing Commission Settings later does not rewrite old rows.

### 2.4 Worked example — restore these pesos

Customer payment **₱1,000**:

| Line | Amount |
|------|--------|
| Credits consumed | ₱970 |
| Commission pool | ₱30 |
| Retailer 30% of pool | ₱9 |
| Franchisee 20% of pool | ₱6 |
| Sub-Franchisee 10% of pool | ₱3 |
| Platform 40% of pool | ₱12 |

Customer payment **₱2,000** (same rates as the client sheet’s Retailer 2 sales cell):

| Line | Current app | Client sheet |
|------|-------------|--------------|
| Sales | ₱2,000 | ₱2,000 |
| Sub | ₱6 (10% of ₱60 pool) | ₱600 (30% of sales) |
| Franchisee | ₱12 | ₱400 |
| Retailer | ₱18 | ₱200 |
| Sum of those three | ₱36 | ₱1,200 |
| Platform | ₱24 | not shown |

### 2.5 What Commission Settings can change without a code change

Per retailer, Admin or Sub can set Retailer % and Franchisee %. Sub is remainder after 40% platform. Split must total 100% of the **pool**.

To **label-match** the sheet (Sub 30 / Fran 20 / Retailer 10) without changing the 3% pool:

- Retailer **10**, Franchisee **20** → Sub **30**, Platform **40**
- ₱2,000 sale then pays ₱18 / ₱12 / ₱6 (sub / fran / retailer), still of the ₱60 pool — **not** the sheet pesos

That settings tweak is **not** a revert of this baseline; it is an optional overlay. Revert of the **pool** means restoring 0.95 + 0.02 credits and % of `distributable`, not % of `customerPayment`.

---

## 3. Client sheet target (proposed, not implemented)

Source: client file `Sub-Franchisee Reports .XLSX`, table **REVENUE SHARING SUB-FRANCHISEE**.

Columns: Date · Franchisee / Retailers (franchisee header + retailer rows) · Sales · Revenue Share Sub-Franchisee 30% · Revenue Share Franchisee 20% · Retailer Revenue Share 10% · Total Revenue.

Footer totals on the sample: Sales 5,500.00 · Sub 1,650.00 · Fran 1,100.00 · Retailer 550.00 · Total 3,300.00.

**Finance conflict if both models run on the same peso:**

```
credits 97% of sales  +  sheet shares 60% of sales  =  157% of the customer payment
```

That cannot be paid from one sale unless credits consumed are reduced, or the sheet % apply to something other than gross sales (for example the 3% pool). Document any product decision here when you implement.

If the sheet is read as a **100% of GMV** split, the implied fourth party is Platform **40% of Sales** (40 + 30 + 20 + 10). That is a different product from inventory-at-97% + pool-at-3%.

---

## 4. Surfaces that currently assume the 3% pool

Restore behavior on all of these if the sheet model is rolled back:

| Surface | What it shows today |
|---------|---------------------|
| Record demo sale | Preview credits ~97%, remaining due as pool |
| Transactions | Customer payment, credits consumed, Sale Margin = pool |
| Transaction details | 4-tier % of pool |
| Revenue | Sales Commission = viewer % of pool; Total earnings = IC earnings + that commission (not 60% of sales) |
| Reports | Sales Volume = payments; commission tables use pool; CSVs include pool + stamped % |
| Wallet (retailer) | Sale Margin card = all-time pool |
| Commission Settings preview | Sample ₱100 payment / ₱97 deduction / ₱3 pool |

Internet Credits load cards must stay a **separate stream** in either model.

---

## 5. Revert checklist

If a later change applies 30/20/10 to **sales** (or drops the 3% pool):

1. Restore `DEMO_SALE_BASE_COST_RATE = 0.95` and `DEMO_SALE_PROCESSING_FEE_RATE = 0.02` in `src/lib/transactions.js`.
2. Keep `estimateDemoSaleCosts` as payment − 97% credits = pool; do **not** set pool = customer payment.
3. Keep `buildTransactionDistribution` / `getViewerShareAmount` multiplying **distributable** (pool), not `customerPayment`.
4. Restore `DEFAULT_SHARE_PERCENTAGES` to `{ retailer: 30, franchisee: 20, subfranchisee: 10, company: 40 }` unless a separate settings-only change was intended.
5. Restore `buildCommissionPreview` default `sampleDeduction = 97`.
6. Restore Commission Settings copy: it prices the **commission pool**; platform fee 40%; sub = remainder.
7. Restore Transactions / Revenue / Reports / Wallet labels: Sale Margin = commission pool = ~3% of payment.
8. Reset Demo Data (or reseed transactions) so stamped rows match the restored formula. Old sales kept under the sheet model will still show sheet-sized amounts until cleared.
9. Re-check `docs/app-modules.md` §6 and this file’s worked example (₱1,000 → ₱970 + ₱30).
10. If the Internet Credits User Guide or `esari-computations.xlsx` were edited for the sheet model, regenerate them from the pre-change generators / committed copies.

Git: this snapshot was written while `main` still used the 3% pool (`bb5a595` era and later until a sale-math commit). Use `git log -p -- src/lib/transactions.js src/lib/commission.js` to find the commit that diverged, then revert that commit or restore the constants above.

---

## 6. What a sheet-aligned change would touch (for the future implementer)

Not done yet. Expected blast radius if following the sheet:

- `estimateDemoSaleCosts` / wallet burn (cannot keep 97% burn and 60% cash shares)
- `buildTransactionDistribution` base amount (`customerPayment` vs `distributable`)
- `DEFAULT_SHARE_PERCENTAGES` assignment (sheet: Sub 30, Fran 20, Retailer 10; app default: Retailer 30, Sub 10)
- Whether platform 40% is of sales, of a pool, or omitted
- Commission Settings validation (today requires 100% including platform)
- Seeded transactions, Reports Sub grouped table (if added), User Guide sale examples, computations workbook

Prefer a dedicated commit message such as `Switch sale commission from 3% pool to client sheet % of sales` so `git revert` is obvious.
