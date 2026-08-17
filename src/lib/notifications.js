import { FUNDING_STATUS, ROLE_LABELS, ROLES } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import {
  getRequestCredits,
  getRequestDepositAmount,
} from '@/lib/internetCredits'
import {
  getWalletBalanceStatus,
  LOW_BALANCE_THRESHOLD,
  WALLET_BALANCE_STATUS,
  WALLET_BALANCE_STATUS_LABELS,
} from '@/lib/wallets'

export const NOTIFICATION_KIND = {
  LOW_BALANCE: 'low_balance',
  CREDIT_REQUEST: 'credit_request',
}

const TYPE_LABELS = {
  platform: 'Platform',
  subfranchisee: ROLE_LABELS[ROLES.SUBFRANCHISEE],
  franchisee: ROLE_LABELS[ROLES.FRANCHISEE],
  retailer: ROLE_LABELS[ROLES.RETAILER],
}

export function getWalletPathForRole(role) {
  if (role === ROLES.RETAILER) return '/wallet'
  if (role === ROLES.ADMIN) return '/wallets'
  return '/wallet-management'
}

export function getInternetCreditsPathForRole(role) {
  if (role === ROLES.RETAILER) return '/request-funding'
  return '/funding'
}

export function getNewCreditsRequestHref(role) {
  return `${getInternetCreditsPathForRole(role)}?newRequest=1`
}

export function getUplineOrganizationIds(organizations = [], organizationId) {
  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const ids = []
  const seen = new Set()
  let current = orgById[organizationId]

  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId)
    ids.push(current.parentId)
    current = orgById[current.parentId]
  }

  return ids
}

function isPendingStatus(status) {
  return String(status || '').toLowerCase() === FUNDING_STATUS.PENDING
}

function wasReadAfter(readEntry, updatedAt) {
  if (!readEntry?.readAt) return false
  if (!updatedAt) return true
  const readTime = new Date(readEntry.readAt).getTime()
  const updatedTime = new Date(updatedAt).getTime()
  if (Number.isNaN(readTime)) return false
  if (Number.isNaN(updatedTime)) return true
  return readTime >= updatedTime
}

function buildCopy({ isSelf, status, subjectName, typeLabel, availableBalance }) {
  const statusLabel = WALLET_BALANCE_STATUS_LABELS[status] || 'Low Balance'
  const amount = formatCurrency(availableBalance)
  const threshold = formatCurrency(LOW_BALANCE_THRESHOLD)
  const isZero = status === WALLET_BALANCE_STATUS.ZERO

  if (isSelf) {
    return {
      title: isZero ? 'Your credits are at zero' : 'Your credits are low',
      body: isZero
        ? `Available Credits are ${amount}. Request Internet Credits from your upline to restock.`
        : `Available Credits are ${amount}. We alert you when the balance is ${threshold} or less. Request Internet Credits from your upline to restock.`,
    }
  }

  return {
    title: isZero
      ? `${subjectName} has zero credits`
      : `${subjectName} is on low balance`,
    body: `${typeLabel} · Available Credits ${amount} · ${statusLabel} (≤ ${threshold}). They may need a credit load.`,
  }
}

/**
 * Live low-balance alerts for the signed-in organization:
 * the entity itself plus every upline of each low/zero wallet.
 */
export function buildLowBalanceNotifications({
  organizations = [],
  wallets = [],
  recipientOrganizationId,
  recipientRole,
  reads = {},
} = {}) {
  if (!recipientOrganizationId) return []

  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const recipientReads = reads[recipientOrganizationId] || {}
  const href = getWalletPathForRole(recipientRole)

  const alerts = []

  wallets.forEach((wallet) => {
    if (wallet.walletType === 'revenue') return

    const org = orgById[wallet.organizationId]
    if (!org) return

    const availableBalance = Number(wallet.availableBalance) || 0
    const status = getWalletBalanceStatus(availableBalance)
    if (
      status !== WALLET_BALANCE_STATUS.LOW &&
      status !== WALLET_BALANCE_STATUS.ZERO
    ) {
      return
    }

    const recipientIds = [
      org.id,
      ...getUplineOrganizationIds(organizations, org.id),
    ]
    if (!recipientIds.includes(recipientOrganizationId)) return

    const isSelf = org.id === recipientOrganizationId
    const typeLabel = TYPE_LABELS[org.type] || org.type
    const copy = buildCopy({
      isSelf,
      status,
      subjectName: org.name,
      typeLabel,
      availableBalance,
    })
    const id = `${recipientOrganizationId}:${org.id}:${status}`
    const readEntry = recipientReads[id]
    const createdAt = wallet.updatedAt || wallet.createdAt || null

    alerts.push({
      id,
      kind: NOTIFICATION_KIND.LOW_BALANCE,
      recipientOrganizationId,
      subjectOrganizationId: org.id,
      subjectName: org.name,
      subjectCode: org.code || '',
      subjectType: org.type,
      typeLabel,
      isSelf,
      status,
      availableBalance,
      href,
      title: copy.title,
      body: copy.body,
      read: Boolean(readEntry?.readAt),
      createdAt,
    })
  })

  const rank = (status) => (status === WALLET_BALANCE_STATUS.ZERO ? 0 : 1)

  return alerts.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1
    if (a.status !== b.status) return rank(a.status) - rank(b.status)
    return a.subjectName.localeCompare(b.subjectName)
  })
}

/**
 * Pending Internet Credits requests submitted by direct downlines.
 * Direct Release never queues, so it is excluded.
 * Updating a still-pending request marks the alert unread again.
 */
export function buildPendingCreditRequestNotifications({
  organizations = [],
  fundingRequests = [],
  recipientOrganizationId,
  recipientRole,
  reads = {},
} = {}) {
  if (!recipientOrganizationId) return []

  const orgById = Object.fromEntries(organizations.map((org) => [org.id, org]))
  const recipientReads = reads[recipientOrganizationId] || {}
  const href = getInternetCreditsPathForRole(recipientRole)

  const alerts = []

  ;(fundingRequests || []).forEach((request) => {
    if (!isPendingStatus(request.status)) return
    if (request.directTransfer) return
    if (request.parentOrganizationId !== recipientOrganizationId) return

    const requester = orgById[request.organizationId]
    const typeLabel =
      TYPE_LABELS[requester?.type] ||
      ROLE_LABELS[request.requesterRole] ||
      'Downline'
    const name = requester?.name || request.organizationId || 'A downline'
    const deposit = getRequestDepositAmount(request)
    const credits = getRequestCredits(request)
    const createdAt = request.updatedAt || request.createdAt || null
    const id = `${recipientOrganizationId}:ic-request:${request.id}`
    const readEntry = recipientReads[id]

    alerts.push({
      id,
      kind: NOTIFICATION_KIND.CREDIT_REQUEST,
      recipientOrganizationId,
      subjectOrganizationId: request.organizationId,
      subjectName: name,
      subjectCode: requester?.code || '',
      subjectType: requester?.type || request.requesterRole || '',
      typeLabel,
      requestId: request.id,
      href,
      title: `${name} requested Internet Credits`,
      body: `${typeLabel} · Deposit ${formatCurrency(deposit)} · ${formatCurrency(credits)} credits suggested. Review on Internet Credits.`,
      read: wasReadAfter(readEntry, createdAt),
      createdAt,
    })
  })

  return alerts.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime()
    const bTime = new Date(b.createdAt || 0).getTime()
    return bTime - aTime
  })
}

/**
 * Combined inbox for the header bell: pending credit requests, then low balance.
 */
export function buildNotifications({
  organizations = [],
  wallets = [],
  fundingRequests = [],
  recipientOrganizationId,
  recipientRole,
  reads = {},
} = {}) {
  const creditRequests = buildPendingCreditRequestNotifications({
    organizations,
    fundingRequests,
    recipientOrganizationId,
    recipientRole,
    reads,
  })
  const lowBalance = buildLowBalanceNotifications({
    organizations,
    wallets,
    recipientOrganizationId,
    recipientRole,
    reads,
  })

  const combined = [...creditRequests, ...lowBalance]
  const kindRank = (kind) =>
    kind === NOTIFICATION_KIND.CREDIT_REQUEST ? 0 : 1

  return combined.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1
    if (a.kind !== b.kind) return kindRank(a.kind) - kindRank(b.kind)
    const aTime = new Date(a.createdAt || 0).getTime()
    const bTime = new Date(b.createdAt || 0).getTime()
    if (aTime !== bTime) return bTime - aTime
    return String(a.title).localeCompare(String(b.title))
  })
}

