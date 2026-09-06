import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, '..')
const read = (relative) => readFileSync(join(srcDir, relative), 'utf8')

/**
 * Spec 02 §17 swap-order grep: every swapped page stays API-first via
 * useResourceData + roleResources with importable storage fallback, and no
 * page mixes sources. Admin rebuild pages must read through the companies
 * or collections adapters instead of mockFranchises.
 */
const SWAPPED_PAGES = [
  'pages/wallets/WalletsPage.jsx',
  'pages/wallet/WalletPage.jsx',
  'pages/wallets/WalletManagementPage.jsx',
  'pages/funding/FundingWorkspacePage.jsx',
  'pages/deposit-rates/DepositRatesPage.jsx',
  'pages/commission-settings/CommissionSettingsPage.jsx',
  'pages/transactions/TransactionsPage.jsx',
  'pages/revenue/RevenuePage.jsx',
  'pages/reports/ReportsPage.jsx',
  'pages/dashboard/DashboardPage.jsx',
  'pages/clients/ClientsPage.jsx',
  'pages/clients/ClientDetailPage.jsx',
]

describe('spec 02 §17 swap-order grep', () => {
  it.each(SWAPPED_PAGES)('%s is API-first with fallback (no mixed source)', (page) => {
    const content = read(page)
    expect(content).toMatch('useResourceData')
    expect(content).toMatch('isApiWired()')
    expect(content).toMatch('toRows(')
  })

  it('funding mutations go through the funding bridge (server ints, no REQ- ids)', () => {
    const bridge = read('services/api/fundingBridge.js')
    expect(bridge).toMatch('releaseCreditRequest')
    expect(bridge).toMatch('rejectCreditRequest')
    // No REQ- id is ever constructed or sent: only server ints (request?.id).
    expect(bridge).not.toMatch(/[`'"]REQ-/)
    expect(bridge).not.toMatch(/REQ-\$\{/)
    expect(bridge).toMatch('server ints only')
    const page = read('pages/funding/FundingWorkspacePage.jsx')
    expect(page).toMatch('apiReleaseFundingRequest')
    expect(page).toMatch('apiRejectFundingRequest')
  })

  it('reports CSV downloads go through GET /reports/{slug}/export', () => {
    const resources = read('services/api/roleResources.js')
    expect(resources).toMatch('exportReport')
    expect(resources).toMatch('/export')
    expect(resources).toMatch('exportReportCsvForRole')
  })

  it('notifications resolve per-org read state through role resources', () => {
    const bell = read('components/shared/NotificationBell.jsx')
    expect(bell).toMatch('listNotificationsForRole')
    expect(bell).toMatch('markNotificationsReadForRole')
  })

  it('admin collections go through GET/POST /admin/collections adapters', () => {
    const panel = read('components/shared/FranchiseCollectionsPanel.jsx')
    expect(panel).toMatch('listAdminCollectionsForRole')
    expect(panel).toMatch('createAdminCollectionForRole')
    const resources = read('services/api/adminResources.js')
    expect(resources).toMatch('/collections')
    expect(resources).toMatch('/companies')
    expect(resources).toMatch('/status-audit')
    expect(resources).toMatch('getAdminStatusAudit')
    const detail = read('pages/clients/ClientDetailPage.jsx')
    expect(detail).toMatch('getAdminStatusAudit')
    expect(detail).toMatch('statusAudit')
  })
})
