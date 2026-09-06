import { describe, expect, it } from 'vitest'
import { subfranchisorEndpoints } from '@/lib/api/endpoints'
import { ADMIN_PREFIX } from '@/lib/api/roles'
import {
  adminCollectionsPath,
  adminCompaniesPath,
  adminStatusAuditPath,
} from '@/services/api/adminResources'

// DEFECT-3 note: this list asserts path-builder STRINGS only
// (`exportReport(slug)` -> `/reports/${slug}/export`), not backend
// exportability. `overview` (+ `franchisee-commissions` /
// `retailer-commissions`) are JSON-view routes only — backend spec 02 §12 /
// ReportCsvExporter::SLUGS allowlists 8 CSV slugs and `overview` 404s on
// export. No live caller passes `overview` to CSV export (verified:
// TransactionsPage passes `transactions`; ReportsPage `serverExport` is a
// generic passthrough with no `overview` caller).
const SLUGS = [
  'overview',
  'revenue-sharing',
  'franchisee-commissions',
  'retailer-commissions',
  'internet-credits-earnings',
  'internet-retailer-balance',
  'transactions',
  'sales-commission',
]

describe('spec 02 §17 contract: subfranchisor endpoint map', () => {
  it('exposes auth paths under the subfranchisor prefix', () => {
    expect(subfranchisorEndpoints.login()).toBe('/api/v1/subfranchisor/login')
    expect(subfranchisorEndpoints.logout()).toBe('/api/v1/subfranchisor/logout')
    expect(subfranchisorEndpoints.me()).toBe('/api/v1/subfranchisor/me')
  })

  it('exposes accounts/wallets/credits/rates/commission/transaction/revenue paths', () => {
    expect(subfranchisorEndpoints.franchiseeAccounts()).toBe(
      '/api/v1/subfranchisor/accounts/franchisees',
    )
    expect(subfranchisorEndpoints.retailerAccounts()).toBe(
      '/api/v1/subfranchisor/accounts/retailers',
    )
    expect(subfranchisorEndpoints.allAccounts()).toBe('/api/v1/subfranchisor/accounts/all')
    expect(subfranchisorEndpoints.wallets()).toBe('/api/v1/subfranchisor/wallets')
    expect(subfranchisorEndpoints.wallet(7)).toBe('/api/v1/subfranchisor/wallets/7')
    expect(subfranchisorEndpoints.walletActivity(7)).toBe(
      '/api/v1/subfranchisor/wallets/7/activity',
    )
    expect(subfranchisorEndpoints.creditRequests()).toBe(
      '/api/v1/subfranchisor/internet-credits/requests',
    )
    expect(subfranchisorEndpoints.creditRequest(9)).toBe(
      '/api/v1/subfranchisor/internet-credits/requests/9',
    )
    expect(subfranchisorEndpoints.releaseCreditRequest(9)).toBe(
      '/api/v1/subfranchisor/internet-credits/requests/9/release',
    )
    expect(subfranchisorEndpoints.rejectCreditRequest(9)).toBe(
      '/api/v1/subfranchisor/internet-credits/requests/9/reject',
    )
    expect(subfranchisorEndpoints.directCreditReleases()).toBe(
      '/api/v1/subfranchisor/internet-credits/direct-releases',
    )
    expect(subfranchisorEndpoints.creditTransfers()).toBe(
      '/api/v1/subfranchisor/internet-credits/transfers',
    )
    expect(subfranchisorEndpoints.depositRates()).toBe('/api/v1/subfranchisor/deposit-rates')
    expect(subfranchisorEndpoints.depositRate(3)).toBe('/api/v1/subfranchisor/deposit-rates/3')
    expect(subfranchisorEndpoints.commissionSettings()).toBe(
      '/api/v1/subfranchisor/commission-settings',
    )
    expect(subfranchisorEndpoints.commissionSetting(4)).toBe(
      '/api/v1/subfranchisor/commission-settings/4',
    )
    expect(subfranchisorEndpoints.transactions()).toBe('/api/v1/subfranchisor/transactions')
    expect(subfranchisorEndpoints.transaction(11)).toBe('/api/v1/subfranchisor/transactions/11')
    expect(subfranchisorEndpoints.salesCommission()).toBe(
      '/api/v1/subfranchisor/revenue/sales-commission',
    )
    expect(subfranchisorEndpoints.internetCreditsEarnings()).toBe(
      '/api/v1/subfranchisor/revenue/internet-credits',
    )
  })

  it('routes every report slug through GET /reports/{slug}/export', () => {
    SLUGS.forEach((slug) => {
      expect(subfranchisorEndpoints.exportReport(slug)).toBe(
        `/api/v1/subfranchisor/reports/${slug}/export`,
      )
    })
  })

  it('exposes per-org notification read state paths', () => {
    expect(subfranchisorEndpoints.notifications()).toBe(
      '/api/v1/subfranchisor/notifications',
    )
    expect(subfranchisorEndpoints.markNotificationsRead()).toBe(
      '/api/v1/subfranchisor/notifications/read',
    )
  })

  it('exposes admin companies/collections/status-audit paths (ITEM 2)', () => {
    expect(ADMIN_PREFIX).toBe('/api/v1/admin')
    expect(adminCompaniesPath()).toBe('/api/v1/admin/companies')
    expect(adminStatusAuditPath()).toBe('/api/v1/admin/status-audit')
    expect(adminCollectionsPath('admin')).toBe('/api/v1/admin/collections')
  })
})
