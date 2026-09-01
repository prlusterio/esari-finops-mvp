import { FUNDING_STATUS, ROLES, TRANSACTION_STATUS } from '@/lib/constants'
import { filterItemsByDateRange, formatDateLong } from '@/lib/date'
import {
  getFundingDatasets,
  getFundingWorkspaceConfig,
} from '@/lib/funding'
import {
  buildRevenueEntries,
  getViewerShareAmount,
  REVENUE_ENTRY_STATUS,
  sumRevenueByStatus,
  toRevenueEntryStatus,
} from '@/lib/revenue'
import {
  filterTransactionsForRole,
  getActiveSharePercentages,
  getTransactionCostBreakdown,
  getTransactionShareAmounts,
  sortTransactionsNewest,
  transactionsToCsv,
} from '@/lib/transactions'

export { filterItemsByDateRange }

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function getReportsPageConfig(role) {
  if (role === ROLES.ADMIN) {
    return {
      subtitle:
        'Sale commission distribution plus Internet Credits load cash and inventory.',
      walletLabel: 'Available Credits',
      showFundingExports: true,
      showRevenueExport: true,
      showNetworkFilters: true,
      showRetailerFilter: false,
      showCustomDateRange: true,
      showFranchiseeRevenueTable: true,
      showRetailerRevenueTable: true,
      showNetworkEarningsHero: true,
      showViewerCommissionColumn: true,
      showRevenueShareTable: true,
      yourCommissionLabel: 'Sales Commission',
      viewerCommissionLabel: 'Platform Commission',
      creditEarningsLabel: 'Internet Credits earnings',
      earningsMode: 'platform_load',
      defaultDateRange: 'this_month',
    }
  }

  if (role === ROLES.SUBFRANCHISEE) {
    return {
      subtitle:
        'Your sale commission plus earnings from loading Internet Credits to downlines.',
      walletLabel: 'Available Credits',
      showFundingExports: true,
      showRevenueExport: true,
      showNetworkFilters: true,
      showRetailerFilter: false,
      showCustomDateRange: true,
      showFranchiseeRevenueTable: true,
      showRetailerRevenueTable: true,
      showNetworkEarningsHero: true,
      showViewerCommissionColumn: true,
      showRevenueShareTable: true,
      yourCommissionLabel: 'Sales Commission',
      viewerCommissionLabel: 'Your Commission',
      creditEarningsLabel: 'Internet Credits earnings',
      earningsMode: 'credit_spread',
      defaultDateRange: 'this_month',
    }
  }

  if (role === ROLES.FRANCHISEE) {
    return {
      subtitle:
        'Your sale commission plus earnings from loading Internet Credits to retailers.',
      walletLabel: 'Available Credits',
      showFundingExports: true,
      showRevenueExport: true,
      showNetworkFilters: false,
      showRetailerFilter: true,
      showCustomDateRange: true,
      showFranchiseeRevenueTable: false,
      showRetailerRevenueTable: true,
      showNetworkEarningsHero: true,
      showViewerCommissionColumn: true,
      yourCommissionLabel: 'Sales Commission',
      viewerCommissionLabel: 'Your Commission',
      creditEarningsLabel: 'Internet Credits earnings',
      earningsMode: 'credit_spread',
      defaultDateRange: 'this_month',
    }
  }

  return {
    subtitle:
      'Your sale commission share (from distribution %) plus sales volume. Internet Credits loads stay on Wallet / Internet Credits.',
    walletLabel: 'Available Credits',
    showFundingExports: true,
    showRevenueExport: true,
    showNetworkFilters: false,
    showRetailerFilter: false,
    showCustomDateRange: true,
    showFranchiseeRevenueTable: false,
    showRetailerRevenueTable: false,
    showNetworkEarningsHero: true,
    showViewerCommissionColumn: false,
    yourCommissionLabel: 'Your Commission',
    viewerCommissionLabel: 'Your Commission',
    creditEarningsLabel: 'Sale margin pool',
    earningsMode: 'sale_commission',
    defaultDateRange: 'this_month',
  }
}

export function filterTransactionsByNetwork(
  transactions,
  { franchiseeId = 'all', retailerId = 'all' } = {},
) {
  return transactions.filter((tx) => {
    if (franchiseeId && franchiseeId !== 'all') {
      if (tx.franchiseeOrganizationId !== franchiseeId) return false
    }
    if (retailerId && retailerId !== 'all') {
      if (tx.retailerOrganizationId !== retailerId) return false
    }
    return true
  })
}

export function getNetworkFilterOptions(organizations, organizationId) {
  const root = organizations.find((org) => org.id === organizationId)
  const isPlatformScope = !organizationId || root?.type === 'platform'

  const franchisees = (
    isPlatformScope
      ? organizations.filter((org) => org.type === 'franchisee')
      : organizations.filter(
          (org) => org.parentId === organizationId && org.type === 'franchisee',
        )
  ).sort((a, b) => a.name.localeCompare(b.name))

  const retailersByFranchisee = franchisees.reduce((acc, franchisee) => {
    acc[franchisee.id] = organizations
      .filter(
        (org) => org.parentId === franchisee.id && org.type === 'retailer',
      )
      .sort((a, b) => a.name.localeCompare(b.name))
    return acc
  }, {})

  const nestedRetailers = franchisees.flatMap(
    (franchisee) => retailersByFranchisee[franchisee.id] || [],
  )

  // Franchisee orgs own retailers directly (no nested franchisee layer).
  const directRetailers = organizations
    .filter(
      (org) => org.parentId === organizationId && org.type === 'retailer',
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  // Platform can also own retailers directly (skip franchisee / sub-franchisee).
  const platformDirectRetailers = isPlatformScope
    ? organizations
        .filter(
          (org) =>
            org.type === 'retailer' &&
            (org.parentId === root?.id || org.parentId === organizationId),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  const allRetailers = (() => {
    if (isPlatformScope) {
      const byId = new Map()
      ;[...nestedRetailers, ...platformDirectRetailers].forEach((org) => {
        byId.set(org.id, org)
      })
      return Array.from(byId.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    }
    return nestedRetailers.length > 0 ? nestedRetailers : directRetailers
  })()

  return { franchisees, retailersByFranchisee, allRetailers }
}

/**
 * Resolves which franchisee / retailer orgs appear in network revenue tables
 * for the current role and active filters.
 */
export function getNetworkRevenueParties({
  role,
  organizationId,
  organizations = [],
  franchiseeId = 'all',
  retailerId = 'all',
} = {}) {
  const { franchisees, retailersByFranchisee, allRetailers } =
    getNetworkFilterOptions(organizations, organizationId)

  if (role === ROLES.SUBFRANCHISEE) {
    let franchiseeList =
      franchiseeId && franchiseeId !== 'all'
        ? franchisees.filter((org) => org.id === franchiseeId)
        : franchisees

    let retailerList = []
    if (retailerId && retailerId !== 'all') {
      retailerList = allRetailers.filter((org) => org.id === retailerId)
      const parentId = retailerList[0]?.parentId
      if (parentId) {
        franchiseeList = franchisees.filter((org) => org.id === parentId)
      }
    } else if (franchiseeId && franchiseeId !== 'all') {
      retailerList = retailersByFranchisee[franchiseeId] || []
    } else {
      retailerList = allRetailers
    }

    return { franchisees: franchiseeList, retailers: retailerList }
  }

  if (role === ROLES.FRANCHISEE) {
    const retailerList =
      retailerId && retailerId !== 'all'
        ? allRetailers.filter((org) => org.id === retailerId)
        : allRetailers
    return { franchisees: [], retailers: retailerList }
  }

  if (role === ROLES.ADMIN) {
    let franchiseeList =
      franchiseeId && franchiseeId !== 'all'
        ? franchisees.filter((org) => org.id === franchiseeId)
        : franchisees

    let retailerList = []
    if (retailerId && retailerId !== 'all') {
      retailerList = allRetailers.filter((org) => org.id === retailerId)
      const parentId = retailerList[0]?.parentId
      if (parentId) {
        franchiseeList = franchisees.filter((org) => org.id === parentId)
      }
    } else if (franchiseeId && franchiseeId !== 'all') {
      retailerList = retailersByFranchisee[franchiseeId] || []
    } else {
      retailerList = allRetailers
    }

    return { franchisees: franchiseeList, retailers: retailerList }
  }

  return { franchisees: [], retailers: [] }
}

/**
 * Aggregates each party's earned commission share for scoped transactions.
 * When viewerRole is set, also attributes the viewer's commission from that party's volume.
 */
export function buildPartyRevenueRows({
  parties = [],
  transactions = [],
  revenueSharing = [],
  partyRole,
  viewerRole = null,
  matchTransaction,
  parentNameById = {},
  retailerCountById = {},
} = {}) {
  const percentages = getActiveSharePercentages(revenueSharing)

  const rows = parties.map((party) => {
    const partyTxs = transactions.filter((tx) => matchTransaction(tx, party))
    let customerPayment = 0
    let distributable = 0
    let creditedRevenue = 0
    let pendingRevenue = 0
    let viewerCommission = 0
    let pendingViewerCommission = 0

    partyTxs.forEach((tx) => {
      const costs = getTransactionCostBreakdown(tx)
      customerPayment = roundMoney(
        customerPayment + (Number(tx.customerPayment) || 0),
      )
      distributable = roundMoney(distributable + costs.distributable)

      const share = getViewerShareAmount(tx, percentages, partyRole)
      const viewerShare = viewerRole
        ? getViewerShareAmount(tx, percentages, viewerRole)
        : 0

      if (toRevenueEntryStatus(tx.status) === REVENUE_ENTRY_STATUS.CREDITED) {
        creditedRevenue = roundMoney(creditedRevenue + share)
        viewerCommission = roundMoney(viewerCommission + viewerShare)
      } else {
        pendingRevenue = roundMoney(pendingRevenue + share)
        pendingViewerCommission = roundMoney(
          pendingViewerCommission + viewerShare,
        )
      }
    })

    const retailerCount = Object.prototype.hasOwnProperty.call(
      retailerCountById,
      party.id,
    )
      ? Number(retailerCountById[party.id]) || 0
      : null

    return {
      organizationId: party.id,
      name: party.name,
      code: party.code || '',
      parentName: parentNameById[party.parentId] || '',
      transactionCount: partyTxs.length,
      retailerCount,
      customerPayment,
      distributable,
      creditedRevenue,
      pendingRevenue,
      totalRevenue: roundMoney(creditedRevenue + pendingRevenue),
      viewerCommission,
      pendingViewerCommission,
    }
  })

  return rows
    .sort((a, b) => {
      if (viewerRole) {
        if (b.viewerCommission !== a.viewerCommission) {
          return b.viewerCommission - a.viewerCommission
        }
      }
      if (b.creditedRevenue !== a.creditedRevenue) {
        return b.creditedRevenue - a.creditedRevenue
      }
      return a.name.localeCompare(b.name)
    })
}

function sumPartyField(rows = [], field) {
  return roundMoney(
    rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0),
  )
}

/**
 * Per-transaction revenue rows for a single franchisee or retailer party.
 */
export function buildPartyRevenueDetailEntries({
  transactions = [],
  revenueSharing = [],
  partyRole,
  organizationId,
  partyType = 'retailer',
  viewerRole = null,
} = {}) {
  const percentages = getActiveSharePercentages(revenueSharing)

  return sortTransactionsNewest(
    transactions.filter((tx) => {
      if (partyType === 'franchisee') {
        return tx.franchiseeOrganizationId === organizationId
      }
      return tx.retailerOrganizationId === organizationId
    }),
  ).map((tx) => {
    const costs = getTransactionCostBreakdown(tx)
    const partyRevenue = getViewerShareAmount(tx, percentages, partyRole)
    const viewerRevenue = viewerRole
      ? getViewerShareAmount(tx, percentages, viewerRole)
      : null
    const status = toRevenueEntryStatus(tx.status)

    return {
      id: tx.id,
      reference: tx.reference || tx.id,
      createdAt: tx.createdAt,
      transactionStatus: tx.status,
      status,
      retailerName: tx.retailerName || '',
      retailerCode: tx.retailerCode || '',
      customerPayment: Number(tx.customerPayment) || 0,
      distributableRevenue: costs.distributable,
      partyRevenue,
      viewerRevenue,
      walletDeduction: costs.netWalletDeduction,
    }
  })
}

export function partyRevenueDetailEntriesToCsv(
  entries = [],
  {
    partyLabel = 'Party',
    includeViewerCommission = false,
    viewerLabel = 'Your Commission',
  } = {},
) {
  const headers = [
    'Reference',
    'Date',
    'Retailer',
    'Retailer Code',
    'Sales Volume',
    `${partyLabel} Commission`,
    ...(includeViewerCommission ? [viewerLabel] : []),
    'Status',
  ]

  const rows = entries.map((entry) => [
    entry.reference,
    entry.createdAt,
    entry.retailerName,
    entry.retailerCode,
    entry.customerPayment,
    entry.partyRevenue,
    ...(includeViewerCommission ? [entry.viewerRevenue ?? 0] : []),
    entry.status,
  ])

  return rowsToCsv(headers, rows)
}

function rowsToCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const value = cell == null ? '' : String(cell)
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(','),
    )
    .join('\n')
}

export function fundingRequestsToCsv(requests, orgById = {}) {
  const headers = [
    'Request ID',
    'Type',
    'Organization',
    'Requester Role',
    'Deposit Amount',
    'Suggested Credits',
    'Credits Released',
    'Deposit Rate',
    'Payment Reference',
    'Status',
    'Created At',
    'Updated At',
  ]

  const rows = requests.map((request) => {
    const org = orgById[request.organizationId]
    const deposit =
      Number(request.depositAmount) || Number(request.amount) || 0
    const suggested =
      Number(request.suggestedCredits) || Number(request.amount) || 0
    const released =
      Number(request.creditsReleased) ||
      (request.status === FUNDING_STATUS.RELEASED ||
      request.status === FUNDING_STATUS.APPROVED ||
      request.status === FUNDING_STATUS.COMPLETED
        ? suggested
        : 0)
    const rate =
      Number(request.depositRate) ||
      (suggested > 0 ? roundMoney(deposit / suggested) : '')
    return [
      request.id,
      request.directTransfer ? 'Direct Release' : 'Request',
      org?.name || request.organizationId,
      request.requesterRole,
      deposit,
      suggested,
      released || '',
      rate,
      request.paymentReferenceId || '',
      request.status,
      request.createdAt,
      request.updatedAt,
    ]
  })

  return rowsToCsv(headers, rows)
}

export function fundingTransfersToCsv(transfers, orgById = {}) {
  const headers = [
    'Transfer ID',
    'From',
    'To',
    'Credits Amount',
    'Deposit Amount',
    'Deposit Rate',
    'Payment Reference',
    'Release Source',
    'Status',
    'Funding Request',
    'Created At',
  ]

  const rows = transfers.map((transfer) => {
    const from = orgById[transfer.fromOrganizationId]
    const to = orgById[transfer.toOrganizationId]
    return [
      transfer.id,
      from?.name || transfer.fromOrganizationId,
      to?.name || transfer.toOrganizationId,
      transfer.amount,
      transfer.depositAmount ?? '',
      transfer.depositRate ?? '',
      transfer.paymentReferenceId || '',
      transfer.releaseSource || '',
      transfer.status,
      transfer.fundingRequestId || '',
      transfer.createdAt,
    ]
  })

  return rowsToCsv(headers, rows)
}

export function revenueEntriesToCsv(entries) {
  const headers = [
    'Date',
    'Reference',
    'Retailer',
    'Retailer Code',
    'Sales',
    'Your Share %',
    'Your Commission',
    'Status',
  ]

  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const rows = sorted.map((entry) => [
    entry.createdAt,
    entry.reference,
    entry.retailerName,
    entry.retailerCode,
    entry.distributableRevenue,
    entry.sharePercentage ?? '',
    entry.yourRevenue,
    entry.status,
  ])

  return rowsToCsv(headers, rows)
}

export function creditLoadEntriesToCsv(entries = []) {
  const headers = [
    'Date',
    'Reference',
    'Downline',
    'Cash In',
    'Credits',
    'Earnings',
    'Buy Rate',
    'Sell Rate',
    'Cost Basis',
  ]

  const rows = [...entries].map((entry) => [
    entry.createdAt,
    entry.reference,
    entry.counterpartyName,
    entry.cashIn,
    entry.credits,
    entry.revenue,
    entry.buyRate ?? '',
    entry.sellRate ?? entry.depositRate ?? '',
    entry.costBasis ?? '',
  ])

  return rowsToCsv(headers, rows)
}

/**
 * Builds a role-scoped report snapshot for KPIs and exports.
 */
export function buildReportSnapshot({
  role,
  organizationId,
  dateRange = 'all',
  customDateRange = null,
  franchiseeId = 'all',
  retailerId = 'all',
  organizations = [],
  transactions = [],
  fundingRequests = [],
  fundingTransfers = [],
  wallets = [],
  revenueSharing = [],
}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const fundingConfig = getFundingWorkspaceConfig({
    role,
    organizationId,
    organizations,
  })

  const roleScopedTransactions = filterTransactionsForRole(transactions, {
    role,
    organizationId,
  })
  const networkScopedTransactions = filterTransactionsByNetwork(
    roleScopedTransactions,
    { franchiseeId, retailerId },
  )
  const scopedTransactions = filterItemsByDateRange(
    networkScopedTransactions,
    dateRange,
    'createdAt',
    customDateRange,
  )

  const fundingDatasets = getFundingDatasets({
    role,
    organizationId,
    requests: fundingRequests,
    transfers: fundingTransfers,
    config: fundingConfig,
  })

  const networkOrgIds = new Set()
  if (retailerId && retailerId !== 'all') {
    networkOrgIds.add(retailerId)
  } else if (franchiseeId && franchiseeId !== 'all') {
    networkOrgIds.add(franchiseeId)
    organizations
      .filter((org) => org.parentId === franchiseeId && org.type === 'retailer')
      .forEach((org) => networkOrgIds.add(org.id))
  }

  const matchesNetworkOrg = (orgId) =>
    networkOrgIds.size === 0 || networkOrgIds.has(orgId)

  const scopedFundingRequests = filterItemsByDateRange(
    [
      ...fundingDatasets.incoming,
      ...fundingDatasets.mine,
      ...fundingDatasets.approved,
    ]
      .filter(
        (request, index, list) =>
          list.findIndex((item) => item.id === request.id) === index,
      )
      .filter(
        (request) =>
          matchesNetworkOrg(request.organizationId) ||
          matchesNetworkOrg(request.parentOrganizationId),
      ),
    dateRange,
    'createdAt',
    customDateRange,
  )

  const scopedTransfers = filterItemsByDateRange(
    fundingDatasets.transfers.filter(
      (transfer) =>
        matchesNetworkOrg(transfer.fromOrganizationId) ||
        matchesNetworkOrg(transfer.toOrganizationId),
    ),
    dateRange,
    'createdAt',
    customDateRange,
  )

  const revenueEntries = buildRevenueEntries({
    transactions: scopedTransactions,
    organizations,
    role,
    revenueSharing,
  })
  const revenueTotals = sumRevenueByStatus(revenueEntries)

  const customerPaymentTotal = roundMoney(
    scopedTransactions.reduce(
      (sum, tx) => sum + (Number(tx.customerPayment) || 0),
      0,
    ),
  )
  const distributableTotal = roundMoney(
    scopedTransactions.reduce(
      (sum, tx) => sum + getTransactionCostBreakdown(tx).distributable,
      0,
    ),
  )
  const completedTxCount = scopedTransactions.filter(
    (tx) => tx.status === TRANSACTION_STATUS.COMPLETED,
  ).length
  const pendingTxCount = scopedTransactions.filter(
    (tx) => tx.status === TRANSACTION_STATUS.PENDING,
  ).length

  const fundingAmountTotal = roundMoney(
    scopedFundingRequests.reduce(
      (sum, request) => sum + (Number(request.amount) || 0),
      0,
    ),
  )
  const cashDepositedTotal = roundMoney(
    scopedFundingRequests.reduce((sum, request) => {
      const deposit =
        Number(request.depositAmount) || Number(request.amount) || 0
      return sum + deposit
    }, 0),
  )
  const creditsReleasedTotal = roundMoney(
    scopedFundingRequests.reduce((sum, request) => {
      const isReleased =
        request.status === FUNDING_STATUS.RELEASED ||
        request.status === FUNDING_STATUS.APPROVED ||
        request.status === FUNDING_STATUS.COMPLETED
      if (!isReleased) return sum
      const credits =
        Number(request.creditsReleased) ||
        Number(request.suggestedCredits) ||
        Number(request.amount) ||
        0
      return sum + credits
    }, 0),
  )
  const pendingCreditsTotal = roundMoney(
    scopedFundingRequests.reduce((sum, request) => {
      if (request.status !== FUNDING_STATUS.PENDING) return sum
      const credits =
        Number(request.suggestedCredits) || Number(request.amount) || 0
      return sum + credits
    }, 0),
  )
  const pendingFundingCount = scopedFundingRequests.filter(
    (request) => request.status === FUNDING_STATUS.PENDING,
  ).length
  const transferAmountTotal = roundMoney(
    scopedTransfers.reduce(
      (sum, transfer) => sum + (Number(transfer.amount) || 0),
      0,
    ),
  )

  const wallet =
    role === ROLES.ADMIN
      ? wallets.find(
          (entry) =>
            entry.organizationId === organizationId &&
            (entry.walletType === 'master' || entry.walletType !== 'revenue'),
        )
      : wallets.find(
          (entry) =>
            entry.organizationId === organizationId &&
            entry.walletType !== 'revenue',
        )

  const parties = getNetworkRevenueParties({
    role,
    organizationId,
    organizations,
    franchiseeId,
    retailerId,
  })

  const parentNameById = Object.fromEntries(
    organizations.map((org) => [org.id, org.name]),
  )

  const retailerCountByFranchiseeId = parties.franchisees.reduce(
    (acc, franchisee) => {
      acc[franchisee.id] = organizations.filter(
        (org) => org.parentId === franchisee.id && org.type === 'retailer',
      ).length
      return acc
    },
    {},
  )

  const viewerRole =
    role === ROLES.SUBFRANCHISEE ||
    role === ROLES.FRANCHISEE ||
    role === ROLES.ADMIN
      ? role
      : null

  const franchiseeRevenueRows = buildPartyRevenueRows({
    parties: parties.franchisees,
    transactions: scopedTransactions,
    revenueSharing,
    partyRole: ROLES.FRANCHISEE,
    viewerRole,
    matchTransaction: (tx, party) => tx.franchiseeOrganizationId === party.id,
    parentNameById,
    retailerCountById: retailerCountByFranchiseeId,
  })

  const retailerRevenueRows = buildPartyRevenueRows({
    parties: parties.retailers,
    transactions: scopedTransactions,
    revenueSharing,
    partyRole: ROLES.RETAILER,
    viewerRole,
    matchTransaction: (tx, party) => tx.retailerOrganizationId === party.id,
    parentNameById,
  })

  return {
    orgById,
    walletBalance: wallet?.availableBalance ?? 0,
    kpis: {
      transactionCount: scopedTransactions.length,
      completedTxCount,
      pendingTxCount,
      customerPaymentTotal,
      distributableTotal,
      fundingRequestCount: scopedFundingRequests.length,
      pendingFundingCount,
      fundingAmountTotal,
      cashDepositedTotal,
      creditsReleasedTotal,
      pendingCreditsTotal,
      transferCount: scopedTransfers.length,
      transferAmountTotal,
      pendingRevenue: revenueTotals.pending,
      creditedRevenue: revenueTotals.credited,
      franchiseeCommissionTotal: sumPartyField(
        franchiseeRevenueRows,
        'creditedRevenue',
      ),
      retailerCommissionTotal: sumPartyField(
        retailerRevenueRows,
        'creditedRevenue',
      ),
    },
    networkEarnings: {
      yourCommission: revenueTotals.credited,
      pendingCommission: revenueTotals.pending,
      franchiseeCommission: sumPartyField(
        franchiseeRevenueRows,
        'creditedRevenue',
      ),
      retailerCommission: sumPartyField(retailerRevenueRows, 'creditedRevenue'),
      salesVolume: customerPaymentTotal,
      commissionPool: distributableTotal,
    },
    datasets: {
      transactions: scopedTransactions,
      fundingRequests: scopedFundingRequests,
      transfers: scopedTransfers,
      revenueEntries,
    },
    franchiseeRevenueRows,
    retailerRevenueRows,
  }
}

/**
 * Client-sheet style Sub-Franchisee revenue sharing rollup.
 * Shares are % of sales stamped on each sale. Total Revenue excludes platform fee.
 */
export function buildSubFranchiseeRevenueShareReport({
  transactions = [],
  organizations = [],
  revenueSharing = [],
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const byFranchisee = new Map()

  transactions.forEach((tx) => {
    const costs = getTransactionCostBreakdown(tx)
    const split = getTransactionShareAmounts(tx, revenueSharing)
    const franchiseeId = tx.franchiseeOrganizationId || '_direct'
    const franchiseeName = orgById[franchiseeId]?.name || 'Direct to Admin'
    const retailerId = tx.retailerOrganizationId || tx.id
    const retailerName =
      tx.retailerName || orgById[retailerId]?.name || 'Retailer'

    if (!byFranchisee.has(franchiseeId)) {
      byFranchisee.set(franchiseeId, {
        franchiseeId,
        franchiseeName,
        retailers: new Map(),
      })
    }
    const group = byFranchisee.get(franchiseeId)
    const current = group.retailers.get(retailerId) || {
      retailerId,
      retailerName,
      date: tx.createdAt,
      sales: 0,
      subShare: 0,
      franchiseeShare: 0,
      retailerShare: 0,
      subPct: split.shares.subfranchisee,
      franchiseePct: split.shares.franchisee,
      retailerPct: split.shares.retailer,
    }
    current.sales = roundMoney(current.sales + costs.customerPayment)
    current.subShare = roundMoney(current.subShare + split.subfranchisee)
    current.franchiseeShare = roundMoney(
      current.franchiseeShare + split.franchisee,
    )
    current.retailerShare = roundMoney(current.retailerShare + split.retailer)
    if (String(tx.createdAt || '') > String(current.date || '')) {
      current.date = tx.createdAt
    }
    group.retailers.set(retailerId, current)
  })

  const groups = [...byFranchisee.values()]
    .map((group) => {
      const retailers = [...group.retailers.values()]
        .map((row) => ({
          ...row,
          totalRevenue: roundMoney(
            row.subShare + row.franchiseeShare + row.retailerShare,
          ),
        }))
        .sort((a, b) => a.retailerName.localeCompare(b.retailerName))
      const totals = retailers.reduce(
        (sum, row) => ({
          sales: roundMoney(sum.sales + row.sales),
          subShare: roundMoney(sum.subShare + row.subShare),
          franchiseeShare: roundMoney(sum.franchiseeShare + row.franchiseeShare),
          retailerShare: roundMoney(sum.retailerShare + row.retailerShare),
          totalRevenue: roundMoney(sum.totalRevenue + row.totalRevenue),
        }),
        {
          sales: 0,
          subShare: 0,
          franchiseeShare: 0,
          retailerShare: 0,
          totalRevenue: 0,
        },
      )
      return { ...group, retailers, totals }
    })
    .sort((a, b) => a.franchiseeName.localeCompare(b.franchiseeName))

  const grandTotal = groups.reduce(
    (sum, group) => ({
      sales: roundMoney(sum.sales + group.totals.sales),
      subShare: roundMoney(sum.subShare + group.totals.subShare),
      franchiseeShare: roundMoney(
        sum.franchiseeShare + group.totals.franchiseeShare,
      ),
      retailerShare: roundMoney(sum.retailerShare + group.totals.retailerShare),
      totalRevenue: roundMoney(sum.totalRevenue + group.totals.totalRevenue),
    }),
    {
      sales: 0,
      subShare: 0,
      franchiseeShare: 0,
      retailerShare: 0,
      totalRevenue: 0,
    },
  )

  return { groups, grandTotal }
}

export function subFranchiseeRevenueShareToCsv(report) {
  const headers = [
    'Date',
    'Franchisee / Retailers',
    'Sales',
    'Revenue Share Sub-Franchisee',
    'Revenue Share Franchisee',
    'Retailer Revenue Share',
    'Total Revenue',
  ]
  const lines = []
  ;(report?.groups || []).forEach((group) => {
    lines.push([
      '',
      `${group.franchiseeName} (Franchisee)`,
      '',
      '',
      '',
      '',
      '',
    ])
    group.retailers.forEach((row) => {
      lines.push([
        formatDateLong(row.date),
        row.retailerName,
        row.sales.toFixed(2),
        row.subShare.toFixed(2),
        row.franchiseeShare.toFixed(2),
        row.retailerShare.toFixed(2),
        row.totalRevenue.toFixed(2),
      ])
    })
  })
  const total = report?.grandTotal || {
    sales: 0,
    subShare: 0,
    franchiseeShare: 0,
    retailerShare: 0,
    totalRevenue: 0,
  }
  lines.push([
    '',
    'Total',
    total.sales.toFixed(2),
    total.subShare.toFixed(2),
    total.franchiseeShare.toFixed(2),
    total.retailerShare.toFixed(2),
    total.totalRevenue.toFixed(2),
  ])
  return [headers, ...lines]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')
}

export function exportTransactionsCsv(
  transactions,
  orgById,
  { revenueSharing = [] } = {},
) {
  return transactionsToCsv(transactions, orgById, { revenueSharing })
}
