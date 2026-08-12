import { FUNDING_STATUS } from '@/lib/constants'
import {
  getFundingRequests,
  getFundingTransfers,
  getWallets,
  saveFundingRequests,
  saveFundingTransfers,
  saveWallets,
} from '@/services/storage'

/**
 * Operating / master wallet for an org (excludes revenue wallets).
 * @param {Array} wallets
 * @param {string} organizationId
 */
export function getOperatingWallet(wallets, organizationId) {
  return (wallets || []).find(
    (wallet) =>
      wallet.organizationId === organizationId &&
      wallet.walletType !== 'revenue',
  )
}

function createNextTransferId(existing) {
  const maxNumber = existing.reduce((max, transfer) => {
    const match = String(transfer.id || '').match(/TRF-(\d+)/i)
    if (!match) return max
    return Math.max(max, Number(match[1]))
  }, 5002)
  return `TRF-${maxNumber + 1}`
}

function createNextRequestId(existing) {
  const maxNumber = existing.reduce((max, request) => {
    const match = String(request.id || '').match(/REQ-(\d+)/i)
    if (!match) return max
    return Math.max(max, Number(match[1]))
  }, 1245)
  return `REQ-${maxNumber + 1}`
}

/**
 * Debit sender + credit recipient, append completed transfer, persist to localStorage.
 *
 * @param {{
 *   fromOrganizationId: string,
 *   toOrganizationId: string,
 *   amount: number,
 *   fundingRequestId?: string,
 *   notes?: string,
 *   proofOfPayment?: object | null,
 * }} params
 */
export function executeWalletTransfer({
  fromOrganizationId,
  toOrganizationId,
  amount,
  fundingRequestId,
  notes = '',
  proofOfPayment = null,
}) {
  const numericAmount = Number(amount)
  if (!fromOrganizationId || !toOrganizationId) {
    throw new Error('Both sender and recipient organizations are required.')
  }
  if (fromOrganizationId === toOrganizationId) {
    throw new Error('Sender and recipient must be different organizations.')
  }
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Enter a valid amount greater than 0.')
  }

  const wallets = getWallets()
  const fromWallet = getOperatingWallet(wallets, fromOrganizationId)
  const toWallet = getOperatingWallet(wallets, toOrganizationId)

  if (!fromWallet || !toWallet) {
    throw new Error('Unable to locate one of the wallets for this transfer.')
  }

  if (numericAmount > Number(fromWallet.availableBalance)) {
    throw new Error('Amount exceeds available wallet balance.')
  }

  const now = new Date().toISOString()
  const updatedWallets = wallets.map((wallet) => {
    if (wallet.id === fromWallet.id) {
      return {
        ...wallet,
        availableBalance: Number(wallet.availableBalance) - numericAmount,
        updatedAt: now,
      }
    }
    if (wallet.id === toWallet.id) {
      return {
        ...wallet,
        availableBalance: Number(wallet.availableBalance) + numericAmount,
        updatedAt: now,
      }
    }
    return wallet
  })

  const existingTransfers = getFundingTransfers()
  const transfer = {
    id: createNextTransferId(existingTransfers),
    fromOrganizationId,
    toOrganizationId,
    amount: numericAmount,
    status: FUNDING_STATUS.COMPLETED,
    fundingRequestId: fundingRequestId || undefined,
    notes: String(notes || '').trim(),
    proofOfPayment: proofOfPayment || undefined,
    createdAt: now,
    updatedAt: now,
  }

  saveWallets(updatedWallets)
  saveFundingTransfers([transfer, ...existingTransfers])

  return { transfer, wallets: updatedWallets }
}

/**
 * Approve a pending funding request and complete the wallet transfer.
 * Status: pending → completed.
 *
 * @param {object} request
 * @param {string} actorOrganizationId Approver's org (must match parentOrganizationId)
 */
export function approveAndTransferFundingRequest(request, actorOrganizationId) {
  if (!request?.id) {
    throw new Error('Funding request is required.')
  }
  if (request.status !== FUNDING_STATUS.PENDING) {
    throw new Error('Only pending funding requests can be approved.')
  }
  if (request.parentOrganizationId !== actorOrganizationId) {
    throw new Error('You are not authorized to approve this funding request.')
  }

  const { transfer } = executeWalletTransfer({
    fromOrganizationId: request.parentOrganizationId,
    toOrganizationId: request.organizationId,
    amount: request.amount,
    fundingRequestId: request.id,
    notes: request.notes || '',
    proofOfPayment: request.proofOfPayment || null,
  })

  const now = new Date().toISOString()
  const existing = getFundingRequests()
  const updatedRequest = {
    ...request,
    status: FUNDING_STATUS.COMPLETED,
    updatedAt: now,
  }
  const updatedRequests = existing.map((item) =>
    item.id === request.id ? updatedRequest : item,
  )
  saveFundingRequests(updatedRequests)

  return { request: updatedRequest, transfer }
}

/**
 * Reject a pending funding request.
 *
 * @param {object} request
 * @param {{ reason?: string }} [options]
 */
export function rejectFundingRequest(request, options = {}) {
  if (!request?.id) {
    throw new Error('Funding request is required.')
  }
  if (request.status !== FUNDING_STATUS.PENDING) {
    throw new Error('Only pending funding requests can be rejected.')
  }

  const now = new Date().toISOString()
  const reason = String(options.reason || '').trim()
  const updatedRequest = {
    ...request,
    status: FUNDING_STATUS.REJECTED,
    rejectionReason: reason || undefined,
    updatedAt: now,
  }

  const existing = getFundingRequests()
  const updatedRequests = existing.map((item) =>
    item.id === request.id ? updatedRequest : item,
  )
  saveFundingRequests(updatedRequests)

  return { request: updatedRequest }
}

/**
 * Create a new pending funding request.
 *
 * @param {{
 *   organizationId: string,
 *   requesterRole: string,
 *   parentOrganizationId: string,
 *   amount: number,
 *   notes?: string,
 *   proofOfPayment: object,
 * }} payload
 */
export function createFundingRequest(payload) {
  const numericAmount = Number(payload.amount)
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Enter a valid amount greater than 0.')
  }
  if (!payload.proofOfPayment) {
    throw new Error('Proof of payment is required.')
  }
  if (!payload.organizationId || !payload.parentOrganizationId) {
    throw new Error('Organization details are required.')
  }

  const existing = getFundingRequests()
  const now = new Date().toISOString()
  const request = {
    id: createNextRequestId(existing),
    organizationId: payload.organizationId,
    requesterRole: payload.requesterRole,
    parentOrganizationId: payload.parentOrganizationId,
    amount: numericAmount,
    status: FUNDING_STATUS.PENDING,
    notes: String(payload.notes || '').trim(),
    proofOfPayment: payload.proofOfPayment,
    createdAt: now,
    updatedAt: now,
  }

  saveFundingRequests([request, ...existing])
  return { request }
}
