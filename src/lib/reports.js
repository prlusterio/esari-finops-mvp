import { FUNDING_STATUS, ROLES, TRANSACTION_STATUS } from '@/lib/constants'
import { filterItemsByDateRange } from '@/lib/date'
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
      subtitle: 'Platform operational and financial reports.',
      walletLabel: 'Master Wallet',
      showFundingExports: true,
      showRevenueExport: true,
      showNetworkFilters: false,
      showRetailerFilter: false,
      showCustomDateRange: true,
      showFranchiseeRevenueTable: false,
      showRetailerRevenueTable: false,
    }
  }

  if (role === ROLES.SUBFRANCHISEE) {
    return {
      subtitle: 'Reports for your sub-franchisee network.',
      walletLabel: 'Operating Wallet',
      showFundingExports: true,
      showRevenueExport: true,
      showNetworkFilters: true,
      showRetailerFilter: false,
      showCustomDateRange: true,
      showFranchiseeRevenueTable: true,
      showRetailerRevenueTable: true,
    }
  }

  if (role === ROLES.FRANCHISEE) {
    return {
      subtitle: 'Reports for your franchisee network.',
      walletLabel: 'Operating Wallet',
      showFundingExports: true,
      showRevenueExport: true,
      showNetworkFilters: false,
      showRetailerFilter: true,
      showCustomDateRange: true,
      showFranchiseeRevenueTable: false,
      showRetailerRevenueTable: true,
    }
  }

  return {
    subtitle: 'Reports for your retailer activity.',
    walletLabel: 'Operating Wallet',
    showFundingExports: true,
    showRevenueExport: true,
    showNetworkFilters: false,
    showRetailerFilter: false,
    showCustomDateRange: true,
    showFranchiseeRevenueTable: false,
    showRetailerRevenueTable: false,
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
  const franchisees = organizations
    .filter(
      (org) => org.parentId === organizationId && org.type === 'franchisee',
    )
    .sort((a, b) => a.name.localeCompare(b.name))

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

  const allRetailers =
    nestedRetailers.length > 0 ? nestedRetailers : directRetailers

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

  return { franchisees: [], retailers: [] }
}

/**
 * Aggregates each party's earned commission share for scoped transactions.
 */
export function buildPartyRevenueRows({
  parties = [],
  transactions = [],
  revenueSharing = [],
  partyRole,
  matchTransaction,
  parentNameById = {},
} = {}) {
  const percentages = getActiveSharePercentages(revenueSharing)

  return parties
    .map((party) => {
      const partyTxs = transactions.filter((tx) => matchTransaction(tx, party))
      let customerPayment = 0
      let distributable = 0
      let creditedRevenue = 0
      let pendingRevenue = 0

      partyTxs.forEach((tx) => {
        const costs = getTransactionCostBreakdown(tx)
        customerPayment = roundMoney(
          customerPayment + (Number(tx.customerPayment) || 0),
        )
        distributable = roundMoney(distributable + costs.distributable)

        const share = getViewerShareAmount(tx, percentages, partyRole)
        if (toRevenueEntryStatus(tx.status) === REVENUE_ENTRY_STATUS.CREDITED) {
          creditedRevenue = roundMoney(creditedRevenue + share)
        } else {
          pendingRevenue = roundMoney(pendingRevenue + share)
        }
      })

      return {
        organizationId: party.id,
        name: party.name,
        code: party.code || '',
        parentName: parentNameById[party.parentId] || '',
        transactionCount: partyTxs.length,
        customerPayment,
        distributable,
        creditedRevenue,
        pendingRevenue,
        totalRevenue: roundMoney(creditedRevenue + pendingRevenue),
      }
    })
    .sort((a, b) => {
      if (b.creditedRevenue !== a.creditedRevenue) {
        return b.creditedRevenue - a.creditedRevenue
      }
      return a.name.localeCompare(b.name)
    })
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
      walletDeduction: costs.netWalletDeduction,
    }
  })
}

export function partyRevenueDetailEntriesToCsv(entries = [], { partyLabel = 'Party' } = {}) {
  const headers = [
    'Reference',
    'Date',
    'Retailer',
    'Retailer Code',
    'Customer Payment',
    'Distributable Revenue',
    `${partyLabel} Revenue`,
    'Status',
  ]

  const rows = entries.map((entry) => [
    entry.reference,
    entry.createdAt,
    entry.retailerName,
    entry.retailerCode,
    entry.customerPayment,
    entry.distributableRevenue,
    entry.partyRevenue,
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
    'Organization',
    'Requester Role',
    'Amount',
    'Status',
    'Created At',
    'Updated At',
  ]

  const rows = requests.map((request) => {
    const org = orgById[request.organizationId]
    return [
      request.id,
      org?.name || request.organizationId,
      request.requesterRole,
      request.amount,
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
    'Amount',
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
      transfer.status,
      transfer.fundingRequestId || '',
      transfer.createdAt,
    ]
  })

  return rowsToCsv(headers, rows)
}

export function revenueEntriesToCsv(entries) {
  const headers = [
    'Reference',
    'Date',
    'Retailer',
    'Retailer Code',
    'Distributable Revenue',
    'Your Revenue',
    'Status',
  ]

  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const rows = sorted.map((entry) => [
    entry.reference,
    entry.createdAt,
    entry.retailerName,
    entry.retailerCode,
    entry.distributableRevenue,
    entry.yourRevenue,
    entry.status,
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

  const franchiseeRevenueRows = buildPartyRevenueRows({
    parties: parties.franchisees,
    transactions: scopedTransactions,
    revenueSharing,
    partyRole: ROLES.FRANCHISEE,
    matchTransaction: (tx, party) => tx.franchiseeOrganizationId === party.id,
    parentNameById,
  })

  const retailerRevenueRows = buildPartyRevenueRows({
    parties: parties.retailers,
    transactions: scopedTransactions,
    revenueSharing,
    partyRole: ROLES.RETAILER,
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
      transferCount: scopedTransfers.length,
      transferAmountTotal,
      pendingRevenue: revenueTotals.pending,
      creditedRevenue: revenueTotals.credited,
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

export function exportTransactionsCsv(
  transactions,
  orgById,
  { revenueSharing = [] } = {},
) {
  return transactionsToCsv(transactions, orgById, { revenueSharing })
}
