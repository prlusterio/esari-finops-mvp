import { ROLES, TRANSACTION_STATUS } from '@/lib/constants'
import { filterItemsByDateRange } from '@/lib/date'

export const DEFAULT_SHARE_PERCENTAGES = {
  retailer: 30,
  franchisee: 20,
  subfranchisee: 10,
  company: 40,
}

/** Demo sale cost mix: 95% product cost + 2% processing = 97% credits consumed. */
export const DEMO_SALE_BASE_COST_RATE = 0.95
export const DEMO_SALE_PROCESSING_FEE_RATE = 0.02

export const DEMO_PRODUCT_CATALOG = [
  'Mobile Load - Globe',
  'Mobile Load - Smart',
  'Mobile Load - TNT',
  'Bills Payment - Meralco',
  'Bills Payment - Maynilad',
  'E-Wallet Cash-in - GCash',
  'E-Wallet Cash-in - Maya',
  'Gaming Credits - Steam',
]

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function pickRandomDemoProduct() {
  const index = Math.floor(Math.random() * DEMO_PRODUCT_CATALOG.length)
  return DEMO_PRODUCT_CATALOG[index]
}

/**
 * Credits consumed and sale margin for a retailer demo sale.
 * Matches the historical seed mix so Revenue / Reports stay comparable.
 */
export function estimateDemoSaleCosts(customerPayment) {
  const payment = roundMoney(Number(customerPayment) || 0)
  const baseCost = roundMoney(payment * DEMO_SALE_BASE_COST_RATE)
  const platformProcessingFee = roundMoney(
    payment * DEMO_SALE_PROCESSING_FEE_RATE,
  )
  const walletDeduction = roundMoney(baseCost + platformProcessingFee)
  return {
    customerPayment: payment,
    baseCost,
    platformProcessingFee,
    walletDeduction,
    saleMargin: roundMoney(payment - walletDeduction),
  }
}

function formatPaymentLabel(amount) {
  const value = Number(amount) || 0
  return `₱${value.toLocaleString('en-PH', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Keeps product/service labels aligned with the customer payment amount.
 * e.g. "Mobile Load - Smart ₱50" + payment 1000 → "Mobile Load - Smart ₱1,000"
 */
export function matchProductServiceToPayment(productService, customerPayment) {
  const amountLabel = formatPaymentLabel(customerPayment)
  const base = String(productService || 'Mobile Load - Globe').trim()
  if (/₱[\d,]+(?:\.\d+)?/.test(base)) {
    return base.replace(/₱[\d,]+(?:\.\d+)?/, amountLabel)
  }
  return `${base} ${amountLabel}`
}

export function resolveSharePercentages(activeConfig) {
  if (!activeConfig) return { ...DEFAULT_SHARE_PERCENTAGES }

  return {
    retailer: Number(
      activeConfig.retailerPercentage ?? DEFAULT_SHARE_PERCENTAGES.retailer,
    ),
    franchisee: Number(
      activeConfig.franchiseePercentage ?? DEFAULT_SHARE_PERCENTAGES.franchisee,
    ),
    subfranchisee: Number(
      activeConfig.subfranchiseePercentage ??
        DEFAULT_SHARE_PERCENTAGES.subfranchisee,
    ),
    company: Number(
      activeConfig.companyPercentage ?? DEFAULT_SHARE_PERCENTAGES.company,
    ),
  }
}

export function getActiveSharePercentages(revenueSharing = []) {
  const configs = Array.isArray(revenueSharing) ? revenueSharing : []
  const active =
    configs.find((entry) => entry.status === 'active') || configs[0] || null
  return resolveSharePercentages(active)
}

/**
 * Prefer share % stamped on the transaction; otherwise use active revenue-sharing config.
 */
export function resolveTransactionSharePercentages(tx, revenueSharing = []) {
  const fallback = getActiveSharePercentages(revenueSharing)
  if (
    tx?.retailerPercentage != null ||
    tx?.franchiseePercentage != null ||
    tx?.subfranchiseePercentage != null ||
    tx?.companyPercentage != null
  ) {
    return {
      retailer: Number(tx.retailerPercentage ?? 0),
      franchisee: Number(tx.franchiseePercentage ?? 0),
      subfranchisee: Number(tx.subfranchiseePercentage ?? 0),
      company: Number(tx.companyPercentage ?? fallback.company),
    }
  }
  return fallback
}

/**
 * Resolves cost breakdown fields for the transaction details sheet.
 */
export function getTransactionCostBreakdown(tx) {
  const customerPayment = roundMoney(Number(tx?.customerPayment) || 0)
  const baseCost = roundMoney(
    Number(
      tx?.baseCost ??
        Math.max(
          (Number(tx?.walletDeduction) || 0) -
            (Number(tx?.platformProcessingFee) || 0),
          0,
        ),
    ),
  )
  const platformProcessingFee = roundMoney(
    Number(
      tx?.platformProcessingFee ??
        Math.max((Number(tx?.walletDeduction) || 0) - baseCost, 0),
    ),
  )
  const netWalletDeduction = roundMoney(
    Number(tx?.walletDeduction ?? baseCost + platformProcessingFee),
  )
  const distributable = roundMoney(
    Number(
      tx?.distributableRevenue ??
        Math.max(customerPayment - netWalletDeduction, 0),
    ),
  )

  return {
    customerPayment,
    baseCost,
    platformProcessingFee,
    netWalletDeduction,
    distributable,
    saleMargin: roundMoney(customerPayment - netWalletDeduction),
  }
}

/**
 * Builds the 4-tier distribution breakdown for a transaction detail view.
 */
export function buildTransactionDistribution(
  tx,
  { organizations = [], role, revenueSharing = [] } = {},
) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const percentages = resolveTransactionSharePercentages(tx, revenueSharing)
  const costs = getTransactionCostBreakdown(tx)
  const distributable = costs.distributable

  const retailerAmount = roundMoney((distributable * percentages.retailer) / 100)
  const franchiseeAmount = roundMoney((distributable * percentages.franchisee) / 100)
  const subfranchiseeAmount = roundMoney(
    (distributable * percentages.subfranchisee) / 100,
  )
  const companyAmount = roundMoney(
    distributable - retailerAmount - franchiseeAmount - subfranchiseeAmount,
  )

  const retailer = orgById[tx?.retailerOrganizationId] || null
  const franchisee =
    orgById[tx?.franchiseeOrganizationId] ||
    (retailer?.parentId ? orgById[retailer.parentId] : null) ||
    null
  const subfranchisee =
    orgById[tx?.subfranchiseeOrganizationId] ||
    (franchisee?.parentId ? orgById[franchisee.parentId] : null) ||
    null

  const formatEntity = (org, fallbackName, fallbackCode) => {
    const name = org?.name || fallbackName
    const code = org?.code || fallbackCode
    if (name && code) return `${name} (${code})`
    return name || code || '—'
  }

  const viewerKey =
    role === ROLES.RETAILER
      ? 'retailer'
      : role === ROLES.FRANCHISEE
        ? 'franchisee'
        : role === ROLES.SUBFRANCHISEE
          ? 'subfranchisee'
          : role === ROLES.ADMIN
            ? 'company'
            : null

  const tiers = [
    {
      key: 'retailer',
      roleLabel: 'Retailer Share',
      initials: 'R',
      percentage: percentages.retailer,
      amount: retailerAmount,
      entity: formatEntity(retailer, tx?.retailerName, tx?.retailerCode),
      amountClassName: 'text-emerald-600',
      avatarClassName: 'bg-blue-600 text-white',
    },
    {
      key: 'franchisee',
      roleLabel: 'Franchisee Share',
      initials: 'F',
      percentage: percentages.franchisee,
      amount: franchiseeAmount,
      entity: formatEntity(franchisee, 'Franchisee', null),
      amountClassName: 'text-emerald-600',
      avatarClassName: 'bg-slate-200 text-slate-700',
    },
    {
      key: 'subfranchisee',
      roleLabel: 'Sub-Franchisee Share',
      initials: 'SF',
      percentage: percentages.subfranchisee,
      amount: subfranchiseeAmount,
      entity: formatEntity(subfranchisee, 'Sub-Franchisee', null),
      amountClassName: 'text-emerald-600',
      avatarClassName: 'bg-blue-600 text-white',
    },
    {
      key: 'company',
      roleLabel: 'Platform Fee',
      initials: 'HQ',
      percentage: percentages.company,
      amount: companyAmount,
      entity: 'eSariSari Corporate',
      amountClassName: 'text-slate-900',
      avatarClassName: 'bg-slate-800 text-white',
    },
  ].map((tier) => {
    const isViewer = tier.key === viewerKey
    return {
      ...tier,
      isViewer,
      label: isViewer ? 'Your Revenue' : tier.roleLabel,
      amountClassName: isViewer ? 'text-blue-600' : tier.amountClassName,
    }
  })

  const viewerTier = tiers.find((tier) => tier.isViewer) || null

  return {
    percentages,
    costs,
    distributable,
    tiers,
    viewerTier,
  }
}

export function getTransactionsPageConfig(role) {
  if (role === ROLES.ADMIN) {
    return {
      subtitle:
        'Platform transaction history with credits consumed and sale commission distribution',
      searchLabel: 'Retailer / Franchisee',
      searchPlaceholder: 'Search by name or ID',
      showRetailerColumn: true,
      showShareColumns: true,
      yourShareLabel: 'Platform Share',
    }
  }

  if (role === ROLES.SUBFRANCHISEE) {
    return {
      subtitle:
        'Network transaction history with credits consumed and your commission share',
      searchLabel: 'Retailer / Franchisee',
      searchPlaceholder: 'Search by name or ID',
      showRetailerColumn: true,
      showShareColumns: true,
      yourShareLabel: 'Your Share',
    }
  }

  if (role === ROLES.FRANCHISEE) {
    return {
      subtitle:
        'Retailer transaction history with credits consumed and your commission share',
      searchLabel: 'Retailer',
      searchPlaceholder: 'Search by name or ID',
      showRetailerColumn: true,
      showShareColumns: true,
      yourShareLabel: 'Your Share',
    }
  }

  return {
    subtitle:
      'Your transaction history with credits consumed, sale margin, and your commission share',
    searchLabel: 'Reference',
    searchPlaceholder: 'Search by reference',
    showRetailerColumn: false,
    showShareColumns: true,
    yourShareLabel: 'Your Share',
  }
}

export function filterTransactionsForRole(transactions, { role, organizationId }) {
  // Product surfaces only completed transactions (Transactions, Revenue, Reports).
  const completed = (transactions || []).filter(
    (tx) => tx.status === TRANSACTION_STATUS.COMPLETED,
  )

  if (role === ROLES.ADMIN) return completed

  if (role === ROLES.SUBFRANCHISEE) {
    return completed.filter(
      (tx) => tx.subfranchiseeOrganizationId === organizationId,
    )
  }

  if (role === ROLES.FRANCHISEE) {
    return completed.filter(
      (tx) => tx.franchiseeOrganizationId === organizationId,
    )
  }

  return completed.filter(
    (tx) => tx.retailerOrganizationId === organizationId,
  )
}

export function applyTransactionFilters(
  transactions,
  {
    dateRange,
    search,
    status,
    retailerId = 'all',
    customDateRange = null,
    organizations = [],
  },
) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))

  const scoped = transactions.filter((tx) => {
    if (status && status !== 'all' && tx.status !== status) {
      return false
    }
    if (retailerId && retailerId !== 'all') {
      if (tx.retailerOrganizationId !== retailerId) return false
    }
    return true
  })

  const dated = filterItemsByDateRange(
    scoped,
    dateRange,
    'createdAt',
    customDateRange,
  )

  if (!search?.trim()) return dated

  const query = search.trim().toLowerCase()
  return dated.filter((tx) => {
    const retailer = orgById[tx.retailerOrganizationId]
    const franchisee = orgById[tx.franchiseeOrganizationId]
    const haystack = [
      tx.reference,
      tx.id,
      tx.retailerName,
      tx.retailerCode,
      retailer?.name,
      retailer?.code,
      franchisee?.name,
      franchisee?.code,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function sortTransactionsNewest(transactions) {
  return [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function getTransactionShareAmounts(tx, revenueSharing = []) {
  const distributable = getTransactionCostBreakdown(tx).distributable
  const shares = resolveTransactionSharePercentages(tx, revenueSharing)
  const retailer = roundMoney((distributable * shares.retailer) / 100)
  const franchisee = roundMoney((distributable * shares.franchisee) / 100)
  const subfranchisee = roundMoney((distributable * shares.subfranchisee) / 100)
  const company = roundMoney(
    distributable - retailer - franchisee - subfranchisee,
  )
  return { retailer, franchisee, subfranchisee, company, distributable, shares }
}

export function getViewerShareAmountForRole(tx, role, revenueSharing = []) {
  const amounts = getTransactionShareAmounts(tx, revenueSharing)
  if (role === ROLES.RETAILER) return amounts.retailer
  if (role === ROLES.FRANCHISEE) return amounts.franchisee
  if (role === ROLES.SUBFRANCHISEE) return amounts.subfranchisee
  if (role === ROLES.ADMIN) return amounts.company
  return 0
}

export function transactionsToCsv(
  transactions,
  orgById = {},
  { revenueSharing = [], role } = {},
) {
  const headers = [
    'Reference',
    'Date',
    'Retailer',
    'Retailer Code',
    'Customer Payment',
    'Credits Consumed',
    'Commission Pool',
    'Retailer %',
    'Franchisee %',
    'Sub-Franchisee %',
    'Platform %',
    'Your Share',
    'Status',
  ]

  const sorted = sortTransactionsNewest(transactions)

  const rows = sorted.map((tx) => {
    const retailer = orgById[tx.retailerOrganizationId]
    const costs = getTransactionCostBreakdown(tx)
    const split = getTransactionShareAmounts(tx, revenueSharing)
    return [
      tx.reference || tx.id,
      tx.createdAt,
      tx.retailerName || retailer?.name || '',
      tx.retailerCode || retailer?.code || '',
      costs.customerPayment,
      costs.netWalletDeduction,
      costs.saleMargin,
      split.shares.retailer,
      split.shares.franchisee,
      split.shares.subfranchisee,
      split.shares.company,
      role ? getViewerShareAmountForRole(tx, role, revenueSharing) : '',
      tx.status,
    ]
  })

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
