import { FUNDING_STATUS, ROLES, TRANSACTION_STATUS } from '@/lib/constants'
import { filterItemsByDateRange } from '@/lib/date'
import {
  getFundingDatasets,
  getFundingWorkspaceConfig,
} from '@/lib/funding'
import {
  buildRevenueEntries,
  sumRevenueByStatus,
} from '@/lib/revenue'
import {
  filterTransactionsForRole,
  getTransactionCostBreakdown,
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

  const retailerBreakdown = Object.values(
    scopedTransactions.reduce((acc, tx) => {
      const key = tx.retailerOrganizationId || 'unknown'
      if (!acc[key]) {
        acc[key] = {
          retailerOrganizationId: key,
          retailerName: tx.retailerName || orgById[key]?.name || 'Unknown',
          retailerCode: tx.retailerCode || orgById[key]?.code || '',
          count: 0,
          customerPayment: 0,
          distributable: 0,
        }
      }
      acc[key].count += 1
      acc[key].customerPayment = roundMoney(
        acc[key].customerPayment + (Number(tx.customerPayment) || 0),
      )
      acc[key].distributable = roundMoney(
        acc[key].distributable + getTransactionCostBreakdown(tx).distributable,
      )
      return acc
    }, {}),
  )
    .sort((a, b) => b.customerPayment - a.customerPayment)
    .slice(0, 5)

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
    retailerBreakdown,
  }
}

export function exportTransactionsCsv(
  transactions,
  orgById,
  { revenueSharing = [] } = {},
) {
  return transactionsToCsv(transactions, orgById, { revenueSharing })
}
