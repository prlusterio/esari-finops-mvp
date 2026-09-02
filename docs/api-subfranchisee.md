# Sub-Franchisee API contract (unwired)

**Status:** Client + DTOs exist. **Not wired.** Pages still read and write `localStorage`.  
**Repo:** `esari-finops-mvp`  
**Backend convention:** `esarisari-admin-v3` (`/api/v1`, `{ success, message, data }`, Sanctum Bearer).  
**Path prefix:** `/api/v1/subfranchisor`  
**MVP role string:** `subfranchisee` (UI). Backend namespace: `subfranchisor`.

Do not import `src/services/api/subfranchisor` from pages, `AuthContext`, or `src/services/storage.js` until wiring is an explicit task.

---

## How this is meant to be wired later

1. Set `VITE_API_BASE_URL` (origin only, no trailing slash). Until then every call throws `ApiError` with code `API_NOT_WIRED`.
2. Store the Sanctum token in `localStorage.api_token` (same key as admin-v3). `loginSubfranchisor` already writes it.
3. Swap page loaders one resource at a time. DTOs use the same camelCase fields as current localStorage records.
4. Keep `src/services/fundingActions.js`, `storage.js`, and seed as the live path until each swap is done.

---

## Envelope

```json
{ "success": true, "message": "Successful.", "data": {} }
```

Errors: `{ "success": false, "message": "..." }` and Laravel 422 `{ "errors": { "field": ["..."] } }`.  
Auth header: `Authorization: Bearer <token>`.

---

## Resources vs live Sub pages

| Live page | Resource module | Notes |
|-----------|-----------------|--------|
| `/login` (Sub account) | `auth.js` | Reuses admin-v3 `login` / `logout` / `me` |
| `/wallet-management` | `wallets.js` + `accounts.js` | Directory of own + downline operating wallets |
| `/funding` | `internetCredits.js` | Incoming, mine, release, reject, direct release |
| `/deposit-rates` | `depositRates.js` | Sub → Franchisee hop only |
| `/commission-settings` | `commissionSettings.js` | Sub may set retailer, franchisee, own share; platform fee is Admin-owned |
| `/transactions` | `transactions.js` | Scoped by `subfranchiseeOrganizationId` |
| `/revenue` | `revenue.js` | Sales commission + Internet Credits spread |
| `/reports` | `reports.js` | Includes client-sheet revenue-sharing rollup and retailer balance report |
| Notification bell | `notifications.js` | Pending franchisee requests + low balance |

---

## Endpoints

All paths are under `/api/v1/subfranchisor`.

### Auth (already in admin-v3)

| Method | Path | Client |
|--------|------|--------|
| POST | `/login` | `loginSubfranchisor` |
| POST | `/logout` | `logoutSubfranchisor` |
| GET | `/me` | `getSubfranchisorMe` |

### Accounts (already in admin-v3)

| Method | Path | Client |
|--------|------|--------|
| GET | `/accounts/franchisees` | `listFranchiseeAccounts` |
| GET | `/accounts/retailers` | `listRetailerAccounts` |
| GET | `/accounts/all` | `listNetworkAccounts` |

### FinOps (proposed; not in admin-v3 today)

| Method | Path | Client |
|--------|------|--------|
| GET | `/wallets` | `listWallets` |
| GET | `/wallets/{id}` | `getWallet` |
| GET | `/wallets/{id}/activity` | `listWalletActivity` |
| GET | `/internet-credits/requests` | `listCreditRequests` |
| POST | `/internet-credits/requests` | `createCreditRequest` |
| GET | `/internet-credits/requests/{id}` | `getCreditRequest` |
| PUT | `/internet-credits/requests/{id}` | `updateCreditRequest` |
| DELETE | `/internet-credits/requests/{id}` | `deleteCreditRequest` |
| POST | `/internet-credits/requests/{id}/release` | `releaseCreditRequest` |
| POST | `/internet-credits/requests/{id}/reject` | `rejectCreditRequest` |
| POST | `/internet-credits/direct-releases` | `createDirectCreditRelease` |
| GET | `/internet-credits/transfers` | `listCreditTransfers` |
| GET | `/deposit-rates` | `listDepositRates` |
| PUT | `/deposit-rates/{organizationId}` | `upsertDepositRate` |
| DELETE | `/deposit-rates/{organizationId}` | `deleteDepositRate` |
| GET | `/commission-settings` | `listCommissionSettings` |
| POST | `/commission-settings` | `createCommissionSetting` |
| PUT | `/commission-settings/{id}` | `updateCommissionSetting` |
| GET | `/transactions` | `listSaleTransactions` |
| GET | `/transactions/{id}` | `getSaleTransaction` |
| GET | `/revenue/sales-commission` | `listSalesCommission` |
| GET | `/revenue/internet-credits` | `listInternetCreditsEarnings` |
| GET | `/reports/overview` | `getReportOverview` |
| GET | `/reports/revenue-sharing` | `getRevenueSharingReport` |
| GET | `/reports/franchisee-commissions` | `getFranchiseeCommissionsReport` |
| GET | `/reports/retailer-commissions` | `getRetailerCommissionsReport` |
| GET | `/reports/internet-credits-earnings` | `getInternetCreditsEarningsReport` |
| GET | `/reports/internet-retailer-balance` | `getInternetRetailerBalanceReport` |
| GET | `/reports/{slug}/export` | `exportReport` |
| GET | `/notifications` | `listNotifications` |
| POST | `/notifications/read` | `markNotificationsRead` |

Query filters for list/report GETs: `dateRange`, `from`, `to`, `franchiseeId`, `retailerId`, `search`, `page`, `perPage`.

---

## Code map

| Path | Role |
|------|------|
| `src/lib/api/config.js` | Base URL, token key, `isApiWired()` |
| `src/lib/api/client.js` | `fetch` + envelope unwrap |
| `src/lib/api/endpoints.js` | Path builders |
| `src/services/api/subfranchisor/` | Resource functions + JSDoc DTOs |

These modules are unused by the running app. `grep` of `src/pages` and `src/context` should find no imports from `services/api`.
