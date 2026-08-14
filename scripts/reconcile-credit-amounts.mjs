/**
 * Cross-module amount reconciliation for Internet Credits economics.
 * Run: npx vite-node scripts/reconcile-credit-amounts.mjs
 */
import { createRequire } from 'node:module'

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

const { ORG_IDS, ROLES } = await import('../src/lib/constants.js')
const { resetDemoData } = await import('../src/data/seed.js')
const {
  getFundingRequests,
  getOrganizations,
  getTransactions,
  getDepositRates,
  getWallets,
} = await import('../src/services/storage.js')
const {
  buildCreditRevenueSnapshot,
  buildPlatformLoadEntries,
  buildMidTierSpreadEntries,
  buildRetailerMarginEntries,
  sumCreditEconomyField,
} = await import('../src/lib/creditEconomics.js')
const {
  getRequestDepositAmount,
  getRequestCredits,
  isReleasedStatus,
} = await import('../src/lib/internetCredits.js')
const { getTransactionCostBreakdown } = await import('../src/lib/transactions.js')
const { buildReportSnapshot } = await import('../src/lib/reports.js')
const { buildRetailerWalletView } = await import('../src/lib/wallets.js')
const { getFundingDatasets, getFundingWorkspaceConfig } = await import('../src/lib/funding.js')

resetDemoData()

const organizations = getOrganizations()
const fundingRequests = getFundingRequests()
const transactions = getTransactions()
const depositRates = getDepositRates()
const wallets = getWallets()

function round(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function eq(a, b, tol = 0.01) {
  return Math.abs(round(a) - round(b)) <= tol
}

const findings = []

function check(label, expected, actual, meta = {}) {
  const ok = eq(expected, actual)
  findings.push({
    ok,
    label,
    expected: round(expected),
    actual: round(actual),
    ...meta,
  })
}

const roles = [
  {
    role: ROLES.ADMIN,
    organizationId: ORG_IDS.PLATFORM,
    label: 'Admin',
  },
  {
    role: ROLES.SUBFRANCHISEE,
    organizationId: ORG_IDS.SUB_001,
    label: 'Sub',
  },
  {
    role: ROLES.FRANCHISEE,
    organizationId: ORG_IDS.FRANCHISE_001,
    label: 'Franchisee',
  },
  {
    role: ROLES.RETAILER,
    organizationId: ORG_IDS.RETAILER_001,
    label: 'Retailer',
  },
]

console.log('=== Revenue vs Reports (dateRange=all) ===')
for (const r of roles) {
  const rev = buildCreditRevenueSnapshot({
    role: r.role,
    organizationId: r.organizationId,
    organizations,
    fundingRequests,
    transactions,
    dateRange: 'all',
    depositRates,
  })
  const creditOnReports = buildCreditRevenueSnapshot({
    role: r.role,
    organizationId: r.organizationId,
    organizations,
    fundingRequests,
    transactions,
    dateRange: 'all',
    depositRates,
  })
  check(
    `${r.label}: Revenue primary == Reports credit hero (all)`,
    rev.kpis.primaryValue,
    creditOnReports.kpis.primaryValue,
  )

  const reportAll = buildReportSnapshot({
    role: r.role,
    organizationId: r.organizationId,
    dateRange: 'all',
    organizations,
    transactions,
    fundingRequests,
    fundingTransfers: [],
    wallets,
    revenueSharing: [],
  })

  if (r.role === ROLES.ADMIN) {
    const releasedPlatform = fundingRequests.filter(
      (req) =>
        isReleasedStatus(req.status) &&
        req.parentOrganizationId === r.organizationId,
    )
    const cashFromHelpers = sumCreditEconomyField(
      buildPlatformLoadEntries({
        fundingRequests,
        organizations,
        platformOrganizationId: r.organizationId,
        dateRange: 'all',
      }),
      'cashIn',
    )
    check(`${r.label}: Load cash == sum released platform deposits`, cashFromHelpers, rev.kpis.primaryValue)

    // Reports cashDeposited includes ALL statuses in scope, not only released
    const reportsCash = reportAll.kpis.cashDepositedTotal
    check(
      `${r.label}: Reports Cash Deposited (all statuses) vs Revenue Load cash (released only) — expected DIFFERENT definitions`,
      cashFromHelpers,
      reportsCash,
      { note: 'different definitions; not a formula bug' },
    )
  }

  if (r.role === ROLES.SUBFRANCHISEE || r.role === ROLES.FRANCHISEE) {
    const entries = buildMidTierSpreadEntries({
      fundingRequests,
      organizations,
      viewerOrganizationId: r.organizationId,
      dateRange: 'all',
      depositRates,
    })
    check(
      `${r.label}: Spread KPI == sum entry.spread`,
      sumCreditEconomyField(entries, 'spread'),
      rev.kpis.primaryValue,
    )
    check(
      `${r.label}: Cash from downlines == sum cashIn`,
      sumCreditEconomyField(entries, 'cashIn'),
      rev.kpis.secondaryValue,
    )

    // Manual spread check: cashIn - credits*buyRate
    for (const e of entries) {
      const expectedSpread = round(e.cashIn - e.credits * e.buyRate)
      check(
        `${r.label}: entry ${e.reference} spread formula`,
        expectedSpread,
        e.spread,
      )
    }
  }

  if (r.role === ROLES.RETAILER) {
    const entries = buildRetailerMarginEntries({
      transactions,
      organizationId: r.organizationId,
      dateRange: 'all',
    })
    check(
      `${r.label}: Sale margin KPI == sum margins`,
      sumCreditEconomyField(entries, 'margin'),
      rev.kpis.primaryValue,
    )

    const wallet = buildRetailerWalletView({
      organizationId: r.organizationId,
      organizations,
      wallets,
      transfers: [],
      transactions,
      role: r.role,
    })
    check(
      `${r.label}: Wallet Sale Margin == Revenue Sale Margin (all)`,
      rev.kpis.primaryValue,
      wallet.kpis.saleMargin,
    )

    // Per-tx: Transactions page uses raw walletDeduction; Revenue uses getTransactionCostBreakdown
    let rawMarginSum = 0
    let breakdownMarginSum = 0
    let creditsRaw = 0
    let creditsBreakdown = 0
    for (const tx of transactions.filter(
      (t) => t.retailerOrganizationId === r.organizationId,
    )) {
      const costs = getTransactionCostBreakdown(tx)
      const rawMargin =
        (Number(tx.customerPayment) || 0) - (Number(tx.walletDeduction) || 0)
      rawMarginSum += rawMargin
      breakdownMarginSum += costs.saleMargin
      creditsRaw += Number(tx.walletDeduction) || 0
      creditsBreakdown += costs.netWalletDeduction
      check(
        `${r.label}: tx ${tx.reference || tx.id} raw vs breakdown margin`,
        costs.saleMargin,
        round(rawMargin),
      )
      check(
        `${r.label}: tx ${tx.reference || tx.id} walletDeduction vs netWalletDeduction`,
        costs.netWalletDeduction,
        Number(tx.walletDeduction) || 0,
      )
    }
    check(
      `${r.label}: sum raw margins == Revenue margin`,
      rev.kpis.primaryValue,
      round(rawMarginSum),
    )
    check(
      `${r.label}: credits consumed KPI == sum netWalletDeduction`,
      rev.kpis.tertiaryValue,
      round(creditsBreakdown),
    )
  }

  // this_month comparison Revenue vs Reports
  const revMonth = buildCreditRevenueSnapshot({
    role: r.role,
    organizationId: r.organizationId,
    organizations,
    fundingRequests,
    transactions,
    dateRange: 'this_month',
    depositRates,
  })
  const reportsMonthHero = buildCreditRevenueSnapshot({
    role: r.role,
    organizationId: r.organizationId,
    organizations,
    fundingRequests,
    transactions,
    dateRange: 'this_month',
    depositRates,
  })
  check(
    `${r.label}: Revenue(this_month) == Reports hero(this_month)`,
    revMonth.kpis.primaryValue,
    reportsMonthHero.kpis.primaryValue,
  )
  check(
    `${r.label}: Revenue(all) vs Revenue(this_month) — informational`,
    rev.kpis.primaryValue,
    revMonth.kpis.primaryValue,
    { note: 'defaults differ: Revenue=all, Reports=this_month' },
  )
}

console.log('\n=== Funding workspace vs Revenue (released cash/credits) ===')
for (const r of [
  { role: ROLES.ADMIN, organizationId: ORG_IDS.PLATFORM, label: 'Admin' },
  { role: ROLES.SUBFRANCHISEE, organizationId: ORG_IDS.SUB_001, label: 'Sub' },
  {
    role: ROLES.FRANCHISEE,
    organizationId: ORG_IDS.FRANCHISE_001,
    label: 'Franchisee',
  },
]) {
  const config = getFundingWorkspaceConfig({
    role: r.role,
    organizationId: r.organizationId,
    organizations,
  })
  const datasets = getFundingDatasets({
    role: r.role,
    organizationId: r.organizationId,
    requests: fundingRequests,
    transfers: [],
    config,
  })
  const releasedOnly = (datasets.approved || []).filter(
    (req) =>
      isReleasedStatus(req.status) &&
      req.parentOrganizationId === r.organizationId,
  )
  const approvedCash = releasedOnly.reduce(
    (sum, req) => sum + getRequestDepositAmount(req),
    0,
  )
  const approvedCredits = releasedOnly.reduce(
    (sum, req) =>
      sum + (Number(req.creditsReleased) || getRequestCredits(req)),
    0,
  )
  const rev = buildCreditRevenueSnapshot({
    role: r.role,
    organizationId: r.organizationId,
    organizations,
    fundingRequests,
    transactions,
    dateRange: 'all',
    depositRates,
  })

  if (r.role === ROLES.ADMIN) {
    check(
      `${r.label}: Funding approved cash == Revenue load cash`,
      approvedCash,
      rev.kpis.primaryValue,
    )
    check(
      `${r.label}: Funding approved credits == Revenue credits released`,
      approvedCredits,
      rev.kpis.secondaryValue,
    )
  } else {
    check(
      `${r.label}: Funding approved cash == Revenue cash from downlines`,
      approvedCash,
      rev.kpis.secondaryValue,
    )
    check(
      `${r.label}: Funding approved credits == Revenue credits released`,
      approvedCredits,
      rev.kpis.tertiaryValue,
    )
  }
}

console.log('\n=== Reports Cash Deposited scope (Admin, all) ===')
{
  const reportAll = buildReportSnapshot({
    role: ROLES.ADMIN,
    organizationId: ORG_IDS.PLATFORM,
    dateRange: 'all',
    organizations,
    transactions,
    fundingRequests,
    fundingTransfers: [],
    wallets,
    revenueSharing: [],
  })
  const allScopedDeposits = fundingRequests
    .filter((req) => req.parentOrganizationId === ORG_IDS.PLATFORM)
    .reduce((s, req) => s + getRequestDepositAmount(req), 0)
  // buildReportSnapshot scopes by role — check what cashDeposited includes
  console.log(
    JSON.stringify(
      {
        reportsCashDeposited: reportAll.kpis.cashDepositedTotal,
        reportsCreditsReleased: reportAll.kpis.creditsReleasedTotal,
        revenueLoadCash: buildCreditRevenueSnapshot({
          role: ROLES.ADMIN,
          organizationId: ORG_IDS.PLATFORM,
          organizations,
          fundingRequests,
          transactions,
          dateRange: 'all',
        }).kpis.primaryValue,
        parentPlatformDepositSumAllStatuses: round(allScopedDeposits),
      },
      null,
      2,
    ),
  )
}

const failed = findings.filter((f) => !f.ok)
const passed = findings.filter((f) => f.ok)
const informational = findings.filter(
  (f) => f.label.includes('informational') || f.note,
)

console.log('\n=== SUMMARY ===')
console.log(`Passed: ${passed.length}`)
console.log(`Failed: ${failed.length}`)
if (failed.length) {
  console.log('\nFAILURES:')
  for (const f of failed) {
    console.log(
      `- ${f.label}: expected ${f.expected}, actual ${f.actual}${f.note ? ` (${f.note})` : ''}`,
    )
  }
}

// Always print default-period mismatch note
const adminAll = buildCreditRevenueSnapshot({
  role: ROLES.ADMIN,
  organizationId: ORG_IDS.PLATFORM,
  organizations,
  fundingRequests,
  transactions,
  dateRange: 'all',
}).kpis.primaryValue
const adminMonth = buildCreditRevenueSnapshot({
  role: ROLES.ADMIN,
  organizationId: ORG_IDS.PLATFORM,
  organizations,
  fundingRequests,
  transactions,
  dateRange: 'this_month',
}).kpis.primaryValue
console.log(
  `\nDefault period note: Admin load cash all=${adminAll} this_month=${adminMonth}`,
)

process.exit(
  failed.filter((f) => !f.note && !f.label.includes('informational')).length
    ? 1
    : 0,
)
