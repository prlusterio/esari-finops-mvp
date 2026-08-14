import { ROLE_LABELS, ROLES } from '@/lib/constants'
import { getChildOrganizations } from '@/lib/funding'
import {
  buildRetailerMarginEntries,
  sumCreditEconomyField,
} from '@/lib/creditEconomics'
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

export function getWalletTypeRoleLabel(orgType) {
  if (orgType === 'subfranchisee') return ROLE_LABELS[ROLES.SUBFRANCHISEE]
  if (orgType === 'franchisee') return ROLE_LABELS[ROLES.FRANCHISEE]
  if (orgType === 'retailer') return ROLE_LABELS[ROLES.RETAILER]
  return TYPE_LABELS[orgType] || orgType
}
