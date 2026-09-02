import { ROLES } from '@/lib/constants'
import { filterItemsByDateRange } from '@/lib/date'
import { getParentOrganization } from '@/lib/funding'
import {
  getDepositRate,
  getRequestCredits,
  getRequestDepositAmount,
  isReleasedStatus,
} from '@/lib/internetCredits'
import { getTransactionCostBreakdown } from '@/lib/transactions'
import { getDepositRates } from '@/services/storage'

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

function sortNewest(entries) {
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

/**
 * Platform load revenue: cash collected when Admin releases credits to downlines.
 */
export function buildPlatformLoadEntries({
  fundingRequests = [],
  organizations = [],
  platformOrganizationId,
  dateRange = 'all',
  customDateRange = null,
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const released = (fundingRequests || []).filter(
    (request) =>
      isReleasedStatus(request.status) &&
      request.parentOrganizationId === platformOrganizationId,
  )
  const dated = filterItemsByDateRange(
    released,
    dateRange,
    'updatedAt',
    customDateRange,
  )

  const entries = dated.map((request) => {
    const cashIn = getRequestDepositAmount(request)
    const credits = getRequestCredits(request)
    return {
      id: request.id,
      kind: 'platform_load',
      createdAt: request.updatedAt || request.createdAt,
      reference: request.id,
      counterpartyId: request.organizationId,
      counterpartyName:
        orgById[request.organizationId]?.name || request.organizationId,
      cashIn,
      credits,
      revenue: cashIn,
      depositRate: Number(request.depositRate) || null,
    }
  })

  return sortNewest(entries)
}

/**
 * Mid-tier credit spread on downline releases.
 * spread = cashIn − (credits × viewerBuyRate)
 */
export function buildMidTierSpreadEntries({
  fundingRequests = [],
  organizations = [],
  viewerOrganizationId,
  dateRange = 'all',
  customDateRange = null,
  depositRates,
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const viewer = orgById[viewerOrganizationId]
  const viewerParent = getParentOrganization(organizations, viewerOrganizationId)
  const rates = depositRates ?? getDepositRates()

  const buyRate = getDepositRate({
    organizationId: viewerOrganizationId,
    parentOrganizationId: viewerParent?.id,
    orgType: viewer?.type,
    rates,
  })

  const released = (fundingRequests || []).filter(
    (request) =>
      isReleasedStatus(request.status) &&
      request.parentOrganizationId === viewerOrganizationId,
  )
  const dated = filterItemsByDateRange(
    released,
    dateRange,
    'updatedAt',
    customDateRange,
  )

  const entries = dated.map((request) => {
    const cashIn = getRequestDepositAmount(request)
    const credits = getRequestCredits(request)
    const costBasis = roundMoney(credits * buyRate)
    const spread = roundMoney(cashIn - costBasis)
    return {
      id: request.id,
      kind: 'credit_spread',
      createdAt: request.updatedAt || request.createdAt,
      reference: request.id,
      counterpartyId: request.organizationId,
      counterpartyName:
        orgById[request.organizationId]?.name || request.organizationId,
      cashIn,
      credits,
      buyRate,
      costBasis,
      spread,
      revenue: spread,
      sellRate: Number(request.depositRate) || null,
    }
  })

  return sortNewest(entries)
}

/**
 * Retailer leftover after credits: customer payment − credits consumed.
 * Live sales burn 100% of payment, so this is ₱0 for new sales. Kept so
 * older demo stamps still resolve; Wallet no longer shows a Sale Margin card.
 */
export function buildRetailerMarginEntries({
  transactions = [],
  organizationId,
  dateRange = 'all',
  customDateRange = null,
} = {}) {
  const own = (transactions || []).filter(
    (tx) => tx.retailerOrganizationId === organizationId,
  )
  const dated = filterItemsByDateRange(
    own,
    dateRange,
    'createdAt',
    customDateRange,
  )

  const entries = dated.map((tx) => {
    const costs = getTransactionCostBreakdown(tx)
    const creditsConsumed = costs.netWalletDeduction
    const margin = roundMoney(costs.customerPayment - creditsConsumed)
    return {
      id: tx.id,
      kind: 'sale_margin',
      createdAt: tx.createdAt,
      reference: tx.reference || tx.id,
      counterpartyName: tx.productService || 'Internet sale',
      customerPayment: costs.customerPayment,
      creditsConsumed,
      margin,
      revenue: margin,
      transaction: tx,
    }
  })

  return sortNewest(entries)
}

export function sumCreditEconomyField(entries, field) {
  return roundMoney(
    (entries || []).reduce((sum, entry) => sum + (Number(entry[field]) || 0), 0),
  )
}

/**
 * Reports rollup: one row per downline from Internet Credits earnings entries.
 * Earnings uses `revenue` (Admin cash in, Sub/Fran spread).
 */
export function rollupCreditEarningsByDownline(entries = []) {
  const byId = new Map()

  ;(entries || []).forEach((entry) => {
    const id = entry.counterpartyId || entry.counterpartyName || 'unknown'
    const current = byId.get(id) || {
      id,
      name: entry.counterpartyName || id,
      cashIn: 0,
      credits: 0,
      earnings: 0,
      releaseCount: 0,
    }
    current.cashIn = roundMoney(current.cashIn + (Number(entry.cashIn) || 0))
    current.credits = roundMoney(current.credits + (Number(entry.credits) || 0))
    current.earnings = roundMoney(current.earnings + (Number(entry.revenue) || 0))
    current.releaseCount += 1
    if (entry.counterpartyName) current.name = entry.counterpartyName
    byId.set(id, current)
  })

  return [...byId.values()].sort((left, right) => {
    if (right.earnings !== left.earnings) return right.earnings - left.earnings
    return String(left.name).localeCompare(String(right.name))
  })
}

/**
 * Role-scoped revenue snapshot for the Revenue page.
 */
export function buildCreditRevenueSnapshot({
  role,
  organizationId,
  organizations = [],
  fundingRequests = [],
  transactions = [],
  dateRange = 'all',
  customDateRange = null,
  depositRates,
} = {}) {
  if (role === ROLES.ADMIN) {
    const entries = buildPlatformLoadEntries({
      fundingRequests,
      organizations,
      platformOrganizationId: organizationId,
      dateRange,
      customDateRange,
    })
    return {
      mode: 'platform_load',
      title: 'Revenue',
      description:
        'Cash collected when you release Internet Credits to downlines. Sale commissions are listed separately.',
      entries,
      kpis: {
        primaryLabel: 'Internet Credits earnings',
        primaryValue: sumCreditEconomyField(entries, 'cashIn'),
        secondaryLabel: 'Credits released',
        secondaryValue: sumCreditEconomyField(entries, 'credits'),
        tertiaryLabel: 'Releases',
        tertiaryValue: entries.length,
        tertiaryIsCount: true,
      },
    }
  }

  if (role === ROLES.SUBFRANCHISEE || role === ROLES.FRANCHISEE) {
    const entries = buildMidTierSpreadEntries({
      fundingRequests,
      organizations,
      viewerOrganizationId: organizationId,
      dateRange,
      customDateRange,
      depositRates,
    })
    return {
      mode: 'credit_spread',
      title: 'Revenue',
      description:
        'What you earned when downlines bought Internet Credits from you. Sale commissions are listed separately.',
      entries,
      kpis: {
        primaryLabel: 'Internet Credits earnings',
        primaryValue: sumCreditEconomyField(entries, 'spread'),
        secondaryLabel: 'Cash from downlines',
        secondaryValue: sumCreditEconomyField(entries, 'cashIn'),
        tertiaryLabel: 'Credits released',
        tertiaryValue: sumCreditEconomyField(entries, 'credits'),
      },
    }
  }

  if (role === ROLES.RETAILER) {
    const entries = buildRetailerMarginEntries({
      transactions,
      organizationId,
      dateRange,
      customDateRange,
    })
    return {
      mode: 'sale_margin',
      title: 'Revenue',
      description:
        'Your credited share uses the distribution % on each sale. Credits consumed are inventory, not the commission base.',
      entries,
      kpis: {
        primaryLabel: 'Sale margin',
        primaryValue: sumCreditEconomyField(entries, 'margin'),
        secondaryLabel: 'Sales volume',
        secondaryValue: sumCreditEconomyField(entries, 'customerPayment'),
        tertiaryLabel: 'Credits consumed',
        tertiaryValue: sumCreditEconomyField(entries, 'creditsConsumed'),
      },
    }
  }

  return {
    mode: 'none',
    title: 'Revenue',
    description: 'Revenue for your role will be available in a later release.',
    entries: [],
    kpis: {
      primaryLabel: 'Revenue',
      primaryValue: 0,
      secondaryLabel: '—',
      secondaryValue: 0,
      tertiaryLabel: '—',
      tertiaryValue: 0,
    },
  }
}
