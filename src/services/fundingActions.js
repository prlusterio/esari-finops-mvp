import { FUNDING_STATUS } from '@/lib/constants'
import {
  findDuplicatePaymentReference,
  getDepositRate,
  getRequestDepositAmount,
  isReleasedStatus,
  suggestCredits,
} from '@/lib/internetCredits'
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
 * Mint credits to recipient operating wallet without debiting the platform wallet.
 */
function mintCreditsToOrganization({
  toOrganizationId,
  credits,
  fundingRequestId,
  notes = '',
  proofOfPayment = null,
  fromOrganizationId,
  paymentReferenceId,
}) {
  const numericCredits = Number(credits)
  if (!toOrganizationId) {
    throw new Error('Recipient organization is required.')
  }
  if (Number.isNaN(numericCredits) || numericCredits <= 0) {
    throw new Error('Enter a valid credits amount greater than 0.')
  }

  const wallets = getWallets()
  const toWallet = getOperatingWallet(wallets, toOrganizationId)
  if (!toWallet) {
    throw new Error('Unable to locate the recipient wallet.')
  }

  const now = new Date().toISOString()
  const updatedWallets = wallets.map((wallet) => {
    if (wallet.id === toWallet.id) {
      return {
        ...wallet,
        availableBalance: Number(wallet.availableBalance) + numericCredits,
        updatedAt: now,
      }
    }
    return wallet
  })

  const existingTransfers = getFundingTransfers()
  const transfer = {
    id: createNextTransferId(existingTransfers),
    fromOrganizationId: fromOrganizationId || undefined,
    toOrganizationId,
    amount: numericCredits,
    status: FUNDING_STATUS.COMPLETED,
    fundingRequestId: fundingRequestId || undefined,
    notes: String(notes || '').trim() || 'Internet credit release',
    proofOfPayment: proofOfPayment || undefined,
    paymentReferenceId: paymentReferenceId || undefined,
    transferKind: 'internet_credit_mint',
    createdAt: now,
    updatedAt: now,
  }

  saveWallets(updatedWallets)
  saveFundingTransfers([transfer, ...existingTransfers])

  return { transfer, wallets: updatedWallets }
}

/**
 * Move credits from approver Available Credits to requester (mid-tier release).
 */
function transferCreditsFromBalance({
  fromOrganizationId,
  toOrganizationId,
  credits,
  fundingRequestId,
  notes = '',
  proofOfPayment = null,
  paymentReferenceId,
}) {
  const numericCredits = Number(credits)
  if (!fromOrganizationId || !toOrganizationId) {
    throw new Error('Both sender and recipient organizations are required.')
  }
  if (Number.isNaN(numericCredits) || numericCredits <= 0) {
    throw new Error('Enter a valid credits amount greater than 0.')
  }

  const wallets = getWallets()
  const fromWallet = getOperatingWallet(wallets, fromOrganizationId)
  const toWallet = getOperatingWallet(wallets, toOrganizationId)
  if (!fromWallet || !toWallet) {
    throw new Error('Unable to locate one of the wallets for this release.')
  }
  if (numericCredits > Number(fromWallet.availableBalance)) {
    throw new Error(
      'Insufficient Available Credits to release this amount.',
    )
  }

  const now = new Date().toISOString()
  const updatedWallets = wallets.map((wallet) => {
    if (wallet.id === fromWallet.id) {
      return {
        ...wallet,
        availableBalance: Number(wallet.availableBalance) - numericCredits,
        updatedAt: now,
      }
    }
    if (wallet.id === toWallet.id) {
      return {
        ...wallet,
        availableBalance: Number(wallet.availableBalance) + numericCredits,
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
    amount: numericCredits,
    status: FUNDING_STATUS.COMPLETED,
    fundingRequestId: fundingRequestId || undefined,
    notes: String(notes || '').trim() || 'Internet credit release',
    proofOfPayment: proofOfPayment || undefined,
    paymentReferenceId: paymentReferenceId || undefined,
    transferKind: 'internet_credit_transfer',
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
 * (Legacy 1:1 path for non-Admin modules.)
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
 * Release internet credits to requester.
 * - source 'mint' (Admin): create credits without debiting approver
 * - source 'balance' (Sub/Fran): debit approver Available Credits (blocked if short)
 *
 * @param {object} request
 * @param {{
 *   actorOrganizationId: string,
 *   actorUserId?: string,
 *   paymentReferenceId: string,
 *   creditsToRelease: number,
 *   source?: 'mint' | 'balance',
 * }} options
 */
export function releaseInternetCredits(request, options = {}) {
  if (!request?.id) {
    throw new Error('Funding request is required.')
  }
  if (request.status !== FUNDING_STATUS.PENDING) {
    throw new Error('Only pending requests can be released.')
  }
  if (request.parentOrganizationId !== options.actorOrganizationId) {
    throw new Error('You are not authorized to release credits for this request.')
  }

  const paymentReferenceId = String(options.paymentReferenceId || '').trim()
  if (!paymentReferenceId) {
    throw new Error('Payment reference ID is required.')
  }

  const creditsToRelease = Number(options.creditsToRelease)
  if (Number.isNaN(creditsToRelease) || creditsToRelease <= 0) {
    throw new Error('Enter a valid credits amount greater than 0.')
  }

  const releaseSource = options.source === 'balance' ? 'balance' : 'mint'

  const depositAmount = getRequestDepositAmount(request)
  const depositRate =
    Number(request.depositRate) ||
    getDepositRate({
      organizationId: request.organizationId,
      requesterRole: request.requesterRole,
    })
  const suggested =
    Number(request.suggestedCredits) ||
    suggestCredits(depositAmount, depositRate)

  const transferResult =
    releaseSource === 'balance'
      ? transferCreditsFromBalance({
          fromOrganizationId: request.parentOrganizationId,
          toOrganizationId: request.organizationId,
          credits: creditsToRelease,
          fundingRequestId: request.id,
          notes: request.notes || 'Internet credit release',
          proofOfPayment: request.proofOfPayment || null,
          paymentReferenceId,
        })
      : mintCreditsToOrganization({
          fromOrganizationId: request.parentOrganizationId,
          toOrganizationId: request.organizationId,
          credits: creditsToRelease,
          fundingRequestId: request.id,
          notes: request.notes || 'Internet credit release',
          proofOfPayment: request.proofOfPayment || null,
          paymentReferenceId,
        })

  const { transfer } = transferResult

  const now = new Date().toISOString()
  const existing = getFundingRequests()
  const updatedRequest = {
    ...request,
    amount: depositAmount,
    depositAmount,
    depositRate,
    suggestedCredits: suggested,
    creditsReleased: creditsToRelease,
    paymentReferenceId,
    releaseSource,
    status: FUNDING_STATUS.RELEASED,
    approvedAt: now,
    approvedByUserId: options.actorUserId || undefined,
    updatedAt: now,
  }
  saveFundingRequests(
    existing.map((item) => (item.id === request.id ? updatedRequest : item)),
  )

  const duplicate = findDuplicatePaymentReference(
    existing,
    paymentReferenceId,
    request.id,
  )

  return { request: updatedRequest, transfer, duplicatePaymentReference: duplicate }
}

/**
 * Reverse a released internet credit request and claw back credits.
 *
 * @param {object} request
 * @param {{ actorOrganizationId: string, reason?: string }} options
 */
export function reverseInternetCredits(request, options = {}) {
  if (!request?.id) {
    throw new Error('Funding request is required.')
  }
  if (!isReleasedStatus(request.status)) {
    throw new Error('Only released requests can be reversed.')
  }
  if (request.parentOrganizationId !== options.actorOrganizationId) {
    throw new Error('You are not authorized to reverse this request.')
  }

  const reason = String(options.reason || '').trim()
  if (!reason) {
    throw new Error('A reversal reason is required.')
  }

  const credits =
    Number(request.creditsReleased) || getRequestDepositAmount(request)
  if (!(credits > 0)) {
    throw new Error('No credits amount found to reverse.')
  }

  const wallets = getWallets()
  const recipientWallet = getOperatingWallet(wallets, request.organizationId)
  if (!recipientWallet) {
    throw new Error('Unable to locate the recipient wallet.')
  }
  if (Number(recipientWallet.availableBalance) < credits) {
    throw new Error(
      'Cannot reverse: recipient available credits are lower than the released amount.',
    )
  }

  const restoreToParent = request.releaseSource === 'balance'
  const parentWallet = restoreToParent
    ? getOperatingWallet(wallets, request.parentOrganizationId)
    : null
  if (restoreToParent && !parentWallet) {
    throw new Error('Unable to locate the upline wallet to restore credits.')
  }

  const now = new Date().toISOString()
  const updatedWallets = wallets.map((wallet) => {
    if (wallet.id === recipientWallet.id) {
      return {
        ...wallet,
        availableBalance: Number(wallet.availableBalance) - credits,
        updatedAt: now,
      }
    }
    if (parentWallet && wallet.id === parentWallet.id) {
      return {
        ...wallet,
        availableBalance: Number(wallet.availableBalance) + credits,
        updatedAt: now,
      }
    }
    return wallet
  })

  const existingTransfers = getFundingTransfers()
  const transfer = {
    id: createNextTransferId(existingTransfers),
    fromOrganizationId: request.organizationId,
    toOrganizationId: request.parentOrganizationId,
    amount: credits,
    status: FUNDING_STATUS.COMPLETED,
    fundingRequestId: request.id,
    notes: `Internet credit reversal: ${reason}`,
    transferKind: restoreToParent
      ? 'internet_credit_reversal_restore'
      : 'internet_credit_reversal',
    createdAt: now,
    updatedAt: now,
  }

  const existing = getFundingRequests()
  const updatedRequest = {
    ...request,
    status: FUNDING_STATUS.REVERSED,
    reversalReason: reason,
    updatedAt: now,
  }

  saveWallets(updatedWallets)
  saveFundingTransfers([transfer, ...existingTransfers])
  saveFundingRequests(
    existing.map((item) => (item.id === request.id ? updatedRequest : item)),
  )

  return { request: updatedRequest, transfer }
}

/**
 * Reject a pending funding request.
 *
 * @param {object} request
 * @param {{ reason?: string, requireReason?: boolean }} [options]
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
  if (options.requireReason && !reason) {
    throw new Error('A rejection reason is required.')
  }
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
 *   proofOfPayment?: object | null,
 *   depositRate?: number,
 * }} payload
 */
export function createFundingRequest(payload) {
  const numericAmount = Number(payload.amount)
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Enter a valid amount greater than 0.')
  }
  if (!payload.organizationId || !payload.parentOrganizationId) {
    throw new Error('Organization details are required.')
  }

  const depositRate =
    Number(payload.depositRate) ||
    getDepositRate({
      organizationId: payload.organizationId,
      parentOrganizationId: payload.parentOrganizationId,
      requesterRole: payload.requesterRole,
      hop: payload.depositHop,
    })
  const suggestedCredits = suggestCredits(numericAmount, depositRate)

  const existing = getFundingRequests()
  const now = new Date().toISOString()
  const request = {
    id: createNextRequestId(existing),
    organizationId: payload.organizationId,
    requesterRole: payload.requesterRole,
    parentOrganizationId: payload.parentOrganizationId,
    amount: numericAmount,
    depositAmount: numericAmount,
    depositRate,
    suggestedCredits,
    status: FUNDING_STATUS.PENDING,
    notes: String(payload.notes || '').trim(),
    proofOfPayment: payload.proofOfPayment || undefined,
    createdAt: now,
    updatedAt: now,
  }

  saveFundingRequests([request, ...existing])
  return { request }
}
