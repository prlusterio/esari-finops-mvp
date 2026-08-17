import { FUNDING_STATUS, ROLE_LABELS, ROLES, TRANSACTION_STATUS } from '@/lib/constants'
import { filterItemsByDateRange } from '@/lib/date'
import { getChildOrganizations } from '@/lib/funding'
import {
  buildRetailerMarginEntries,
  sumCreditEconomyField,
} from '@/lib/creditEconomics'
import { getTransactionCostBreakdown } from '@/lib/transactions'
import { getOperatingWallet } from '@/services/fundingActions'

export const WALLET_BALANCE_STATUS = {
  SUFFICIENT: 'sufficient',
  LOW: 'low',
  ZERO: 'zero',
}

export const WALLET_BALANCE_STATUS_LABELS = {
  [WALLET_BALANCE_STATUS.SUFFICIENT]: 'Sufficient',
  [WALLET_BALANCE_STATUS.LOW]: 'Low Balance',
  [WALLET_BALANCE_STATUS.ZERO]: 'Zero Balance',
}

const DEFAULT_MINIMUM_BY_TYPE = {
  platform: 100000,
  subfranchisee: 50000,
  franchisee: 25000,
  retailer: 5000,
}

const TYPE_LABELS = {
  platform: 'Platform',
  subfranchisee: 'Sub-Franchisee',
  franchisee: 'Franchisee',
  retailer: 'Retailer',
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function resolveMinimumBalance(wallet, orgType) {
  const configured = Number(wallet?.minimumBalance)
  if (Number.isFinite(configured) && configured > 0) return configured
  return DEFAULT_MINIMUM_BY_TYPE[orgType] || 5000
}

export function getWalletBalanceStatus(availableBalance, minimumBalance) {
  const available = Number(availableBalance) || 0
  if (available <= 0) return WALLET_BALANCE_STATUS.ZERO
  if (available < Number(minimumBalance || 0)) return WALLET_BALANCE_STATUS.LOW
  return WALLET_BALANCE_STATUS.SUFFICIENT
}

function collectNetworkOrgIds(organizations, organizationId) {
  const franchisees = getChildOrganizations(
    organizations,
    organizationId,
    'franchisee',
  )
  const franchiseeIds = franchisees.map((org) => org.id)
  const retailers = organizations.filter(
    (org) =>
      org.type === 'retailer' && franchiseeIds.includes(org.parentId),
  )
  return {
    franchisees,
    retailers,
    networkIds: new Set([
      organizationId,
      ...franchiseeIds,
      ...retailers.map((org) => org.id),
    ]),
  }
}

/**
 * Platform-wide network: platform + all sub-franchisees, franchisees, and retailers
 * (including franchisees/retailers attached directly to admin).
 */
function collectAdminNetworkOrgs(organizations = [], platformId) {
  const subfranchisees = organizations
    .filter((org) => org.type === 'subfranchisee')
    .sort((a, b) => a.name.localeCompare(b.name))
  const franchisees = organizations
    .filter((org) => org.type === 'franchisee')
    .sort((a, b) => a.name.localeCompare(b.name))
  const retailers = organizations
    .filter((org) => org.type === 'retailer')
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    subfranchisees,
    franchisees,
    retailers,
    networkIds: new Set([
      platformId,
      ...subfranchisees.map((org) => org.id),
      ...franchisees.map((org) => org.id),
      ...retailers.map((org) => org.id),
    ]),
  }
}

function mapOperatingWalletRow({
  wallet,
  org,
  orgById,
  organizationId,
  canTransferTo,
}) {
  const parent = org.parentId ? orgById[org.parentId] : null
  const minimumBalance = resolveMinimumBalance(wallet, org.type)
  const availableBalance = roundMoney(Number(wallet.availableBalance) || 0)
  const status = getWalletBalanceStatus(availableBalance, minimumBalance)

  return {
    id: wallet.id,
    wallet,
    organizationId: org.id,
    ownerName: org.name,
    ownerCode: org.code || '',
    orgType: org.type,
    typeLabel: TYPE_LABELS[org.type] || org.type,
    parentName: parent?.name || '—',
    parentType: parent?.type || null,
    availableBalance,
    minimumBalance,
    status,
    canTransferTo: Boolean(canTransferTo),
    isOwnWallet: org.id === organizationId,
  }
}

/**
 * Builds wallet directory rows + KPI totals for CWPC Admin / platform.
 * Transfer targets are direct children of the platform only
 * (sub-franchisee, franchisee, or retailer).
 */
export function buildAdminWalletDirectory({
  organizationId,
  organizations = [],
  wallets = [],
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const { subfranchisees, franchisees, retailers, networkIds } =
    collectAdminNetworkOrgs(organizations, organizationId)

  const operatingWallets = (wallets || []).filter(
    (wallet) =>
      wallet.walletType !== 'revenue' &&
      networkIds.has(wallet.organizationId),
  )

  const rows = operatingWallets
    .map((wallet) => {
      const org = orgById[wallet.organizationId]
      if (!org) return null
      const isDirectChild =
        org.id !== organizationId && org.parentId === organizationId
      return mapOperatingWalletRow({
        wallet,
        org,
        orgById,
        organizationId,
        canTransferTo: isDirectChild,
      })
    })
    .filter(Boolean)
    .sort((a, b) => {
      const typeOrder = {
        platform: 0,
        subfranchisee: 1,
        franchisee: 2,
        retailer: 3,
      }
      const byType =
        (typeOrder[a.orgType] ?? 9) - (typeOrder[b.orgType] ?? 9)
      if (byType !== 0) return byType
      return a.ownerName.localeCompare(b.ownerName)
    })

  const ownWallet =
    rows.find((row) => row.isOwnWallet) ||
    (() => {
      const wallet = getOperatingWallet(wallets, organizationId)
      if (!wallet) return null
      const org = orgById[organizationId]
      const minimumBalance = resolveMinimumBalance(wallet, org?.type || 'platform')
      const availableBalance = roundMoney(Number(wallet.availableBalance) || 0)
      return {
        availableBalance,
        minimumBalance,
        status: getWalletBalanceStatus(availableBalance, minimumBalance),
      }
    })()

  const subfranchiseeRows = rows.filter((row) => row.orgType === 'subfranchisee')
  const franchiseeRows = rows.filter((row) => row.orgType === 'franchisee')
  const retailerRows = rows.filter((row) => row.orgType === 'retailer')

  const sumBalance = (list) =>
    roundMoney(list.reduce((sum, row) => sum + row.availableBalance, 0))

  const lowBalanceCount = rows.filter(
    (row) =>
      row.status === WALLET_BALANCE_STATUS.LOW ||
      row.status === WALLET_BALANCE_STATUS.ZERO,
  ).length

  return {
    orgById,
    rows,
    subfranchisees,
    franchisees,
    retailers,
    kpis: {
      operatingBalance: ownWallet?.availableBalance ?? 0,
      operatingStatus: ownWallet?.status || WALLET_BALANCE_STATUS.ZERO,
      subfranchiseeTotal: sumBalance(subfranchiseeRows),
      subfranchiseeWalletCount: subfranchiseeRows.length,
      franchiseeTotal: sumBalance(franchiseeRows),
      franchiseeWalletCount: franchiseeRows.length,
      retailerTotal: sumBalance(retailerRows),
      retailerWalletCount: retailerRows.length,
      networkWalletCount: rows.length,
      lowBalanceCount,
    },
  }
}

/**
 * Builds wallet directory rows + KPI totals for a sub-franchisee.
 */
export function buildSubFranchiseeWalletDirectory({
  organizationId,
  organizations = [],
  wallets = [],
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const { franchisees, retailers, networkIds } = collectNetworkOrgIds(
    organizations,
    organizationId,
  )

  const operatingWallets = (wallets || []).filter(
    (wallet) =>
      wallet.walletType !== 'revenue' &&
      networkIds.has(wallet.organizationId),
  )

  const rows = operatingWallets
    .map((wallet) => {
      const org = orgById[wallet.organizationId]
      if (!org) return null
      return mapOperatingWalletRow({
        wallet,
        org,
        orgById,
        organizationId,
        canTransferTo: org.type === 'franchisee',
      })
    })
    .filter(Boolean)
    .sort((a, b) => {
      const typeOrder = {
        subfranchisee: 0,
        franchisee: 1,
        retailer: 2,
      }
      const byType =
        (typeOrder[a.orgType] ?? 9) - (typeOrder[b.orgType] ?? 9)
      if (byType !== 0) return byType
      return a.ownerName.localeCompare(b.ownerName)
    })

  const ownWallet =
    rows.find((row) => row.isOwnWallet) ||
    (() => {
      const wallet = getOperatingWallet(wallets, organizationId)
      if (!wallet) return null
      const org = orgById[organizationId]
      const minimumBalance = resolveMinimumBalance(wallet, org?.type)
      const availableBalance = roundMoney(Number(wallet.availableBalance) || 0)
      return {
        availableBalance,
        minimumBalance,
        status: getWalletBalanceStatus(availableBalance, minimumBalance),
      }
    })()

  const franchiseeRows = rows.filter((row) => row.orgType === 'franchisee')
  const retailerRows = rows.filter((row) => row.orgType === 'retailer')

  const sumBalance = (list) =>
    roundMoney(list.reduce((sum, row) => sum + row.availableBalance, 0))

  const lowBalanceCount = rows.filter(
    (row) =>
      row.status === WALLET_BALANCE_STATUS.LOW ||
      row.status === WALLET_BALANCE_STATUS.ZERO,
  ).length

  return {
    orgById,
    rows,
    franchisees,
    retailers,
    kpis: {
      operatingBalance: ownWallet?.availableBalance ?? 0,
      operatingStatus: ownWallet?.status || WALLET_BALANCE_STATUS.ZERO,
      franchiseeTotal: sumBalance(franchiseeRows),
      franchiseeWalletCount: franchiseeRows.length,
      retailerTotal: sumBalance(retailerRows),
      retailerWalletCount: retailerRows.length,
      networkWalletCount: rows.length,
      lowBalanceCount,
    },
  }
}

/**
 * Builds wallet directory rows + KPI totals for a franchisee.
 * Scope: own wallet + retailers under them (not the sub-franchisee upline).
 */
export function buildFranchiseeWalletDirectory({
  organizationId,
  organizations = [],
  wallets = [],
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const retailers = getChildOrganizations(
    organizations,
    organizationId,
    'retailer',
  ).sort((a, b) => a.name.localeCompare(b.name))

  const networkIds = new Set([
    organizationId,
    ...retailers.map((org) => org.id),
  ])

  const operatingWallets = (wallets || []).filter(
    (wallet) =>
      wallet.walletType !== 'revenue' &&
      networkIds.has(wallet.organizationId),
  )

  const rows = operatingWallets
    .map((wallet) => {
      const org = orgById[wallet.organizationId]
      if (!org) return null
      return mapOperatingWalletRow({
        wallet,
        org,
        orgById,
        organizationId,
        canTransferTo: org.type === 'retailer',
      })
    })
    .filter(Boolean)
    .sort((a, b) => {
      const typeOrder = {
        franchisee: 0,
        retailer: 1,
      }
      const byType =
        (typeOrder[a.orgType] ?? 9) - (typeOrder[b.orgType] ?? 9)
      if (byType !== 0) return byType
      return a.ownerName.localeCompare(b.ownerName)
    })

  const ownWallet =
    rows.find((row) => row.isOwnWallet) ||
    (() => {
      const wallet = getOperatingWallet(wallets, organizationId)
      if (!wallet) return null
      const org = orgById[organizationId]
      const minimumBalance = resolveMinimumBalance(wallet, org?.type)
      const availableBalance = roundMoney(Number(wallet.availableBalance) || 0)
      return {
        availableBalance,
        minimumBalance,
        status: getWalletBalanceStatus(availableBalance, minimumBalance),
      }
    })()

  const retailerRows = rows.filter((row) => row.orgType === 'retailer')

  const sumBalance = (list) =>
    roundMoney(list.reduce((sum, row) => sum + row.availableBalance, 0))

  const lowBalanceCount = rows.filter(
    (row) =>
      row.status === WALLET_BALANCE_STATUS.LOW ||
      row.status === WALLET_BALANCE_STATUS.ZERO,
  ).length

  return {
    orgById,
    rows,
    franchisees: [],
    retailers,
    kpis: {
      operatingBalance: ownWallet?.availableBalance ?? 0,
      operatingStatus: ownWallet?.status || WALLET_BALANCE_STATUS.ZERO,
      franchiseeTotal: 0,
      franchiseeWalletCount: 0,
      retailerTotal: sumBalance(retailerRows),
      retailerWalletCount: retailerRows.length,
      networkWalletCount: rows.length,
      lowBalanceCount,
    },
  }
}

/**
 * Builds a retailer-facing wallet summary (own wallets only — no downlines).
 */
export function buildRetailerWalletView({
  organizationId,
  organizations = [],
  wallets = [],
  transfers = [],
  transactions = [],
  role = ROLES.RETAILER,
} = {}) {
  void role
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const org = orgById[organizationId] || null
  const parent = org?.parentId ? orgById[org.parentId] : null
  const parentTypeLabel =
    parent?.type === 'platform'
      ? 'CWPC Admin'
      : parent?.type === 'franchisee'
        ? 'Franchisee'
        : parent?.type === 'subfranchisee'
          ? 'Sub-Franchisee'
          : 'Upline'

  const orgWallets = (wallets || []).filter(
    (wallet) => wallet.organizationId === organizationId,
  )
  const operatingWallet =
    orgWallets.find((wallet) => wallet.walletType !== 'revenue') || null
  const revenueWallet =
    orgWallets.find((wallet) => wallet.walletType === 'revenue') || null

  const marginEntries = buildRetailerMarginEntries({
    transactions,
    organizationId,
    dateRange: 'all',
  })
  const saleMarginTotal = sumCreditEconomyField(marginEntries, 'margin')

  const toRow = (wallet, typeLabel) => {
    if (!wallet) return null
    const minimumBalance = resolveMinimumBalance(wallet, org?.type || 'retailer')
    const availableBalance = roundMoney(Number(wallet.availableBalance) || 0)
    return {
      id: wallet.id,
      wallet,
      organizationId,
      ownerName: org?.name || 'Retailer',
      ownerCode: org?.code || '',
      orgType: org?.type || 'retailer',
      typeLabel,
      parentName: parent?.name || '—',
      parentType: parent?.type || null,
      availableBalance,
      minimumBalance,
      status: getWalletBalanceStatus(availableBalance, minimumBalance),
      canTransferTo: false,
      isOwnWallet: true,
    }
  }

  const operating = toRow(operatingWallet, 'Available Credits')
  const revenue = toRow(revenueWallet, 'Revenue')

  return {
    org,
    parent,
    parentTypeLabel,
    operating,
    revenue,
    activity: buildWalletActivity({
      organizationId,
      transfers,
      organizations,
      openingBalance: operatingWallet?.openingBalance,
      availableBalance: operatingWallet?.availableBalance,
    }),
    kpis: {
      operatingBalance: operating?.availableBalance ?? 0,
      operatingStatus: operating?.status || WALLET_BALANCE_STATUS.ZERO,
      // Same formula as Revenue page (sale margin).
      saleMargin: saleMarginTotal,
      revenueBalance: saleMarginTotal,
      minimumBalance: operating?.minimumBalance ?? 0,
    },
  }
}

/**
 * Builds recent wallet activity from credit releases for an organization.
 * Always includes Opening Credits so Recent Activity reconciles to Available Credits:
 * opening + credits − debits = available.
 */
export function buildWalletActivity({
  organizationId,
  transfers = [],
  organizations = [],
  openingBalance = 0,
  availableBalance = null,
  openingAt = null,
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))

  const relatedTransfers = [...transfers].filter(
    (transfer) =>
      transfer.fromOrganizationId === organizationId ||
      transfer.toOrganizationId === organizationId,
  )

  const transferNet = roundMoney(
    relatedTransfers.reduce((sum, transfer) => {
      const amount = Number(transfer.amount) || 0
      if (transfer.toOrganizationId === organizationId) return sum + amount
      if (transfer.fromOrganizationId === organizationId) return sum - amount
      return sum
    }, 0),
  )

  let opening = roundMoney(Number(openingBalance) || 0)
  if (
    opening <= 0 &&
    availableBalance != null &&
    Number.isFinite(Number(availableBalance))
  ) {
    opening = roundMoney(Number(availableBalance) - transferNet)
  }

  const rows = relatedTransfers.map((transfer) => {
    const isCredit = transfer.toOrganizationId === organizationId
    const counterpartyId = isCredit
      ? transfer.fromOrganizationId
      : transfer.toOrganizationId
    return {
      id: transfer.id,
      createdAt: transfer.createdAt,
      reference: transfer.id,
      typeLabel: isCredit ? 'Credits Received' : 'Credits Released',
      direction: isCredit ? 'credit' : 'debit',
      amount: Number(transfer.amount) || 0,
      counterpartyName: orgById[counterpartyId]?.name || counterpartyId || '—',
    }
  })

  if (opening > 0) {
    const transferTimes = rows
      .map((row) => new Date(row.createdAt).getTime())
      .filter((time) => Number.isFinite(time))
    const openingTime = openingAt ? new Date(openingAt).getTime() : NaN
    const openingIsOldest =
      Number.isFinite(openingTime) &&
      transferTimes.every((time) => time >= openingTime)
    const resolvedOpeningAt = openingIsOldest
      ? openingAt
      : transferTimes.length > 0
        ? new Date(Math.min(...transferTimes) - 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString()

    rows.push({
      id: `opening-${organizationId}`,
      createdAt: resolvedOpeningAt,
      reference: 'OPENING',
      typeLabel: 'Opening Credits',
      direction: 'credit',
      amount: opening,
      counterpartyName: 'Initial inventory',
    })
  }

  return rows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

/**
 * Net effect of activity rows on wallet balance.
 */
export function sumWalletActivityNet(activity = []) {
  return roundMoney(
    activity.reduce((sum, entry) => {
      const amount = Number(entry.amount) || 0
      if (entry.direction === 'debit') return sum - amount
      return sum + amount
    }, 0),
  )
}

export const CREDIT_LEDGER_TYPE = {
  OPENING: 'opening',
  RECEIVED: 'credits_received',
  RELEASED: 'credits_released',
  CONSUMED: 'credits_consumed',
  REVERSAL_IN: 'reversal_in',
  REVERSAL_OUT: 'reversal_out',
}

export const CREDIT_LEDGER_TYPE_LABELS = {
  [CREDIT_LEDGER_TYPE.OPENING]: 'Opening balance',
  [CREDIT_LEDGER_TYPE.RECEIVED]: 'Credits received',
  [CREDIT_LEDGER_TYPE.RELEASED]: 'Credits released',
  [CREDIT_LEDGER_TYPE.CONSUMED]: 'Credits consumed',
  [CREDIT_LEDGER_TYPE.REVERSAL_IN]: 'Credits restored (reversal)',
  [CREDIT_LEDGER_TYPE.REVERSAL_OUT]: 'Credits clawed back (reversal)',
}

const POSTED_TRANSFER_STATUSES = new Set([
  FUNDING_STATUS.COMPLETED,
  FUNDING_STATUS.RELEASED,
  FUNDING_STATUS.APPROVED,
])

function signedLedgerAmount(entry) {
  const amount = Number(entry.amount) || 0
  return entry.direction === 'debit' ? -amount : amount
}

function describeTransferMovement(transfer, organizationId, orgById) {
  const isIn = transfer.toOrganizationId === organizationId
  const counterpartyId = isIn
    ? transfer.fromOrganizationId
    : transfer.toOrganizationId
  const counterpartyName =
    orgById[counterpartyId]?.name || counterpartyId || '—'
  const kind = String(transfer.transferKind || '')
  const isReversal = kind.includes('reversal')

  if (isReversal) {
    return {
      type: isIn ? CREDIT_LEDGER_TYPE.REVERSAL_IN : CREDIT_LEDGER_TYPE.REVERSAL_OUT,
      typeLabel: isIn
        ? CREDIT_LEDGER_TYPE_LABELS[CREDIT_LEDGER_TYPE.REVERSAL_IN]
        : CREDIT_LEDGER_TYPE_LABELS[CREDIT_LEDGER_TYPE.REVERSAL_OUT],
      direction: isIn ? 'credit' : 'debit',
      counterpartyName,
      details:
        transfer.notes ||
        (isIn
          ? `Restored from ${counterpartyName}`
          : `Clawed back to ${counterpartyName}`),
    }
  }

  return {
    type: isIn ? CREDIT_LEDGER_TYPE.RECEIVED : CREDIT_LEDGER_TYPE.RELEASED,
    typeLabel: isIn
      ? CREDIT_LEDGER_TYPE_LABELS[CREDIT_LEDGER_TYPE.RECEIVED]
      : CREDIT_LEDGER_TYPE_LABELS[CREDIT_LEDGER_TYPE.RELEASED],
    direction: isIn ? 'credit' : 'debit',
    counterpartyName,
    details: isIn
      ? `Loaded from ${counterpartyName}`
      : `Released to ${counterpartyName}`,
  }
}

/**
 * Available Credits ledger / balance rollforward for one organization.
 * Opening is backed into from the live wallet so:
 * opening + credits in − credits out − credits consumed = Available Credits.
 * Period filter keeps a period-opening row so 20k → 10k is explainable.
 */
export function buildCreditLedger({
  organizationId,
  organizations = [],
  transfers = [],
  transactions = [],
  wallet = null,
  dateRange = 'all',
  customDateRange = null,
} = {}) {
  if (!organizationId) {
    return {
      openingBalance: 0,
      creditsIn: 0,
      creditsOut: 0,
      closingBalance: 0,
      currentBalance: 0,
      unpostedDifference: 0,
      movements: [],
    }
  }

  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const currentBalance = roundMoney(Number(wallet?.availableBalance) || 0)

  const postedTransfers = (transfers || []).filter(
    (transfer) =>
      POSTED_TRANSFER_STATUSES.has(transfer.status) &&
      (transfer.fromOrganizationId === organizationId ||
        transfer.toOrganizationId === organizationId),
  )

  const saleMovements = (transactions || [])
    .filter(
      (tx) =>
        tx.status === TRANSACTION_STATUS.COMPLETED &&
        tx.retailerOrganizationId === organizationId,
    )
    .map((tx) => {
      const costs = getTransactionCostBreakdown(tx)
      const amount = costs.netWalletDeduction
      return {
        id: `sale-${tx.id}`,
        createdAt: tx.createdAt,
        reference: tx.reference || tx.id,
        type: CREDIT_LEDGER_TYPE.CONSUMED,
        typeLabel: CREDIT_LEDGER_TYPE_LABELS[CREDIT_LEDGER_TYPE.CONSUMED],
        direction: 'debit',
        amount,
        counterpartyName: tx.productService || 'Internet sale',
        details: `Internet sale · customer paid ₱${costs.customerPayment.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        source: 'sale',
        transaction: tx,
      }
    })
    .filter((entry) => entry.amount > 0)

  const transferMovements = postedTransfers.map((transfer) => {
    const meta = describeTransferMovement(transfer, organizationId, orgById)
    return {
      id: transfer.id,
      createdAt: transfer.createdAt,
      reference: transfer.id,
      amount: Number(transfer.amount) || 0,
      source: 'transfer',
      ...meta,
    }
  })

  const eventNet = roundMoney(
    [...transferMovements, ...saleMovements].reduce(
      (sum, entry) => sum + signedLedgerAmount(entry),
      0,
    ),
  )

  // Back into opening from the live wallet so:
  // opening + credits in − credits out − credits consumed = Available Credits.
  // Using the stored openingBalance alone overdrafts the statement whenever
  // seed/demo sales were never deducted from availableBalance.
  const opening = Number.isFinite(currentBalance)
    ? roundMoney(currentBalance - eventNet)
    : roundMoney(Number(wallet?.openingBalance) || 0)

  const openingAt = wallet?.createdAt || null
  const eventTimes = [...transferMovements, ...saleMovements]
    .map((entry) => new Date(entry.createdAt).getTime())
    .filter((time) => Number.isFinite(time))
  const openingTime = openingAt ? new Date(openingAt).getTime() : NaN
  const openingIsOldest =
    Number.isFinite(openingTime) &&
    eventTimes.every((time) => time >= openingTime)
  const resolvedOpeningAt = openingIsOldest
    ? openingAt
    : eventTimes.length > 0
      ? new Date(Math.min(...eventTimes) - 24 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString()

  const allMovements = [...transferMovements, ...saleMovements]
  allMovements.push({
    id: `opening-${organizationId}`,
    createdAt: resolvedOpeningAt,
    reference: 'OPENING',
    type: CREDIT_LEDGER_TYPE.OPENING,
    typeLabel: CREDIT_LEDGER_TYPE_LABELS[CREDIT_LEDGER_TYPE.OPENING],
    direction: opening >= 0 ? 'credit' : 'debit',
    amount: Math.abs(opening),
    counterpartyName: 'Initial inventory',
    details: 'Starting Available Credits',
    source: 'opening',
  })

  const chronological = [...allMovements].sort((a, b) => {
    const timeDiff =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (timeDiff !== 0) return timeDiff
    if (a.type === CREDIT_LEDGER_TYPE.OPENING) return -1
    if (b.type === CREDIT_LEDGER_TYPE.OPENING) return 1
    return String(a.id).localeCompare(String(b.id))
  })

  let running = 0
  const withBalance = chronological.map((entry) => {
    running = roundMoney(running + signedLedgerAmount(entry))
    return { ...entry, runningBalance: running }
  })

  const inPeriod = filterItemsByDateRange(
    withBalance,
    dateRange,
    'createdAt',
    customDateRange,
  )
  const inPeriodIds = new Set(inPeriod.map((entry) => entry.id))
  const beforePeriod = withBalance.filter((entry) => !inPeriodIds.has(entry.id))

  const isAllTime = !dateRange || dateRange === 'all'
  let displayRows = withBalance

  if (!isAllTime && beforePeriod.length > 0) {
    const periodOpening = beforePeriod[beforePeriod.length - 1].runningBalance
    displayRows = [
      {
        id: `period-opening-${organizationId}`,
        createdAt:
          inPeriod[0]?.createdAt ||
          customDateRange?.from ||
          resolvedOpeningAt,
        reference: 'PERIOD-OPEN',
        type: CREDIT_LEDGER_TYPE.OPENING,
        typeLabel: 'Opening balance',
        direction: periodOpening >= 0 ? 'credit' : 'debit',
        amount: Math.abs(periodOpening),
        counterpartyName: 'Balance brought forward',
        details: 'Available Credits at start of selected period',
        source: 'period_opening',
        runningBalance: periodOpening,
      },
      ...inPeriod.filter((entry) => entry.source !== 'opening'),
    ]
  } else if (!isAllTime) {
    displayRows = inPeriod
  }

  const movementRows = displayRows.filter(
    (entry) =>
      entry.source !== 'period_opening' && entry.source !== 'opening',
  )
  const creditsIn = roundMoney(
    movementRows
      .filter((entry) => entry.direction === 'credit')
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
  )
  const creditsOut = roundMoney(
    movementRows
      .filter((entry) => entry.direction === 'debit')
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
  )

  const openingBalance = isAllTime
    ? opening
    : beforePeriod.length > 0
      ? beforePeriod[beforePeriod.length - 1].runningBalance
      : opening
  const closingBalance =
    displayRows.length > 0
      ? displayRows[displayRows.length - 1].runningBalance
      : openingBalance

  const ledgerAllTimeClosing =
    withBalance.length > 0
      ? withBalance[withBalance.length - 1].runningBalance
      : opening
  const unpostedDifference = roundMoney(currentBalance - ledgerAllTimeClosing)

  return {
    openingBalance,
    creditsIn,
    creditsOut,
    closingBalance,
    currentBalance,
    unpostedDifference,
    movements: [...displayRows].reverse(),
  }
}

/**
 * One credit-ledger summary row per organization (franchisee, retailer, etc.).
 */
export function buildCreditLedgerRows({
  parties = [],
  organizations = [],
  wallets = [],
  transfers = [],
  transactions = [],
  dateRange = 'all',
  customDateRange = null,
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))

  return (parties || []).map((party) => {
    const wallet = getOperatingWallet(wallets, party.id)
    const ledger = buildCreditLedger({
      organizationId: party.id,
      organizations,
      transfers,
      transactions,
      wallet,
      dateRange,
      customDateRange,
    })
    const parent = party.parentId ? orgById[party.parentId] : null
    return {
      organizationId: party.id,
      name: party.name,
      code: party.code || '',
      orgType: party.type,
      parentName: parent?.name || '',
      currentBalance: ledger.currentBalance,
      openingBalance: ledger.openingBalance,
      creditsIn: ledger.creditsIn,
      creditsOut: ledger.creditsOut,
      closingBalance: ledger.closingBalance,
      movementCount: ledger.movements.filter(
        (entry) => entry.source !== 'opening' && entry.source !== 'period_opening',
      ).length,
      unpostedDifference: ledger.unpostedDifference,
      ledger,
    }
  })
}

export function creditLedgerToCsv(ledger) {
  const headers = [
    'Date',
    'Type',
    'Reference',
    'Details',
    'In',
    'Out',
    'Running Balance',
  ]
  const rows = (ledger?.movements || []).map((entry) => [
    entry.createdAt,
    entry.typeLabel,
    entry.reference,
    entry.details,
    entry.direction === 'credit' ? entry.amount : '',
    entry.direction === 'debit' ? entry.amount : '',
    entry.runningBalance,
  ])
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

export function getWalletTypeRoleLabel(orgType) {
  if (orgType === 'subfranchisee') return ROLE_LABELS[ROLES.SUBFRANCHISEE]
  if (orgType === 'franchisee') return ROLE_LABELS[ROLES.FRANCHISEE]
  if (orgType === 'retailer') return ROLE_LABELS[ROLES.RETAILER]
  return TYPE_LABELS[orgType] || orgType
}
