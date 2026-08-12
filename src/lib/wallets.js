import { ROLE_LABELS, ROLES } from '@/lib/constants'
import { getChildOrganizations } from '@/lib/funding'
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
        availableBalance,
        minimumBalance,
        status,
        canTransferTo: org.type === 'franchisee',
        isOwnWallet: org.id === organizationId,
      }
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
        availableBalance,
        minimumBalance,
        status,
        canTransferTo: org.type === 'retailer',
        isOwnWallet: org.id === organizationId,
      }
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
 * Builds recent wallet activity from funding transfers for an organization.
 */
export function buildWalletActivity({
  organizationId,
  transfers = [],
  organizations = [],
} = {}) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))

  return [...transfers]
    .filter(
      (transfer) =>
        transfer.fromOrganizationId === organizationId ||
        transfer.toOrganizationId === organizationId,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 20)
    .map((transfer) => {
      const isCredit = transfer.toOrganizationId === organizationId
      const counterpartyId = isCredit
        ? transfer.fromOrganizationId
        : transfer.toOrganizationId
      return {
        id: transfer.id,
        createdAt: transfer.createdAt,
        reference: transfer.id,
        typeLabel: isCredit ? 'Funding Received' : 'Funding Transferred',
        direction: isCredit ? 'credit' : 'debit',
        amount: Number(transfer.amount) || 0,
        counterpartyName:
          orgById[counterpartyId]?.name || counterpartyId || '—',
      }
    })
}

export function getWalletTypeRoleLabel(orgType) {
  if (orgType === 'subfranchisee') return ROLE_LABELS[ROLES.SUBFRANCHISEE]
  if (orgType === 'franchisee') return ROLE_LABELS[ROLES.FRANCHISEE]
  if (orgType === 'retailer') return ROLE_LABELS[ROLES.RETAILER]
  return TYPE_LABELS[orgType] || orgType
}
