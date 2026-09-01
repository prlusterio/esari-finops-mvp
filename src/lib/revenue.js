import { ROLES, TRANSACTION_STATUS } from '@/lib/constants'
import { filterItemsByDateRange } from '@/lib/date'
import {
  getActiveSharePercentages,
  getSaleCommissionBase,
  resolveTransactionSharePercentages,
} from '@/lib/transactions'

export const REVENUE_ENTRY_STATUS = {
  PENDING: 'pending',
  CREDITED: 'credited',
}

export const REVENUE_ENTRY_STATUS_LABELS = {
  [REVENUE_ENTRY_STATUS.PENDING]: 'Pending',
  [REVENUE_ENTRY_STATUS.CREDITED]: 'Credited',
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function getViewerShareKey(role) {
  if (role === ROLES.RETAILER) return 'retailer'
  if (role === ROLES.FRANCHISEE) return 'franchisee'
  if (role === ROLES.SUBFRANCHISEE) return 'subfranchisee'
  if (role === ROLES.ADMIN) return 'company'
  return null
}

export function getViewerSharePercentage(percentages, role) {
  const key = getViewerShareKey(role)
  if (!key || !percentages) return 0
  return Number(percentages[key] || 0)
}

export function getViewerShareAmount(tx, percentages, role) {
  const key = getViewerShareKey(role)
  if (!key) return 0
  return getTransactionShareAmounts(tx, percentages)[key] || 0
}

/**
 * Commission amounts for each hierarchy tier on a transaction.
 * Prefers percentages stamped on the transaction (from that retailer's commission settings).
 */
export function getTransactionShareAmounts(tx, percentages) {
  const distributable = getSaleCommissionBase(tx)
  const fallbackConfig = percentages
    ? [
        {
          status: 'active',
          retailerPercentage: percentages.retailer,
          franchiseePercentage: percentages.franchisee,
          subfranchiseePercentage: percentages.subfranchisee,
          companyPercentage: percentages.company,
        },
      ]
    : []
  const shares = resolveTransactionSharePercentages(tx, fallbackConfig)

  const retailer = roundMoney((distributable * shares.retailer) / 100)
  const franchisee = roundMoney((distributable * shares.franchisee) / 100)
  const subfranchisee = roundMoney((distributable * shares.subfranchisee) / 100)
  const company = roundMoney(
    distributable - retailer - franchisee - subfranchisee,
  )

  return { retailer, franchisee, subfranchisee, company, distributable }
}

export function toRevenueEntryStatus(transactionStatus) {
  return transactionStatus === TRANSACTION_STATUS.COMPLETED
    ? REVENUE_ENTRY_STATUS.CREDITED
    : REVENUE_ENTRY_STATUS.PENDING
}

/**
 * Builds per-transaction revenue ledger rows for the viewing role.
 */
export function buildRevenueEntries({
  transactions = [],
  organizations = [],
  role,
  revenueSharing = [],
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const percentages = getActiveSharePercentages(revenueSharing)

  return transactions
    .map((tx) => {
      const retailer = orgById[tx.retailerOrganizationId]
      const franchisee =
        orgById[tx.franchiseeOrganizationId] ||
        (retailer?.parentId ? orgById[retailer.parentId] : null)
      const distributable = getSaleCommissionBase(tx)
      const yourRevenue = getViewerShareAmount(tx, percentages, role)
      const txShares = resolveTransactionSharePercentages(tx, revenueSharing)
      const sharePercentage = getViewerSharePercentage(txShares, role)
      const status = toRevenueEntryStatus(tx.status)

      return {
        id: tx.id,
        reference: tx.reference || tx.id,
        createdAt: tx.createdAt,
        transactionStatus: tx.status,
        status,
        retailerName: tx.retailerName || retailer?.name || '—',
        retailerCode: tx.retailerCode || retailer?.code || '',
        franchiseeName: franchisee?.name || '',
        retailerOrganizationId: tx.retailerOrganizationId,
        distributableRevenue: distributable,
        yourRevenue,
        sharePercentage,
        transaction: tx,
      }
    })
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
}

export function filterRevenueEntries(
  entries,
  {
    dateRange = 'all',
    search = '',
    status = 'all',
    retailerId = 'all',
    customDateRange = null,
  } = {},
) {
  const statusFiltered = entries.filter((entry) => {
    if (status && status !== 'all' && entry.status !== status) {
      return false
    }
    if (retailerId && retailerId !== 'all') {
      if (entry.retailerOrganizationId !== retailerId) return false
    }
    return true
  })

  const dated = filterItemsByDateRange(
    statusFiltered,
    dateRange,
    'createdAt',
    customDateRange,
  )

  if (!search?.trim()) return dated

  const query = search.trim().toLowerCase()
  return dated.filter((entry) => {
    const haystack = [
      entry.reference,
      entry.id,
      entry.retailerName,
      entry.retailerCode,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function sumRevenueByStatus(entries = []) {
  return entries.reduce(
    (acc, entry) => {
      const amount = Number(entry.yourRevenue) || 0
      if (entry.status === REVENUE_ENTRY_STATUS.PENDING) {
        acc.pending = roundMoney(acc.pending + amount)
      } else if (entry.status === REVENUE_ENTRY_STATUS.CREDITED) {
        acc.credited = roundMoney(acc.credited + amount)
      }
      acc.total = roundMoney(acc.total + amount)
      return acc
    },
    { pending: 0, credited: 0, total: 0 },
  )
}

export function getRevenueWallet(wallets = [], organizationId) {
  if (!organizationId) return null
  return (
    wallets.find(
      (wallet) =>
        wallet.organizationId === organizationId &&
        wallet.walletType === 'revenue',
    ) || null
  )
}

/**
 * Sums credited viewer shares for an org (used when seeding revenue wallets).
 */
export function sumCreditedShareForOrg(
  transactions = [],
  { role, organizationId, revenueSharing = [] } = {},
) {
  const percentages = getActiveSharePercentages(revenueSharing)
  const scoped = transactions.filter((tx) => {
    if (tx.status !== TRANSACTION_STATUS.COMPLETED) return false
    if (role === ROLES.SUBFRANCHISEE) {
      return tx.subfranchiseeOrganizationId === organizationId
    }
    if (role === ROLES.FRANCHISEE) {
      return tx.franchiseeOrganizationId === organizationId
    }
    if (role === ROLES.RETAILER) {
      return tx.retailerOrganizationId === organizationId
    }
    return true
  })

  return roundMoney(
    scoped.reduce(
      (sum, tx) => sum + getViewerShareAmount(tx, percentages, role),
      0,
    ),
  )
}

/**
 * Single source of truth for Revenue Wallet / Credited Revenue cards.
 * Always derived from completed transactions (not a possibly-stale wallet field).
 */
export function resolveCreditedRevenueBalance({
  role,
  organizationId,
  transactions = [],
  revenueSharing = [],
} = {}) {
  return sumCreditedShareForOrg(transactions, {
    role,
    organizationId,
    revenueSharing,
  })
}
