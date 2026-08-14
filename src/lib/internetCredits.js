import { FUNDING_STATUS } from '@/lib/constants'
import { formatCurrency } from '@/lib/currency'
import {
  resolveDepositRate,
  CREDIT_HOPS,
} from '@/lib/depositRates'
import { getDepositRates } from '@/services/storage'

export { CREDIT_HOPS }

/**
 * @param {{
 *   hop?: string,
 *   requesterRole?: string,
 *   organizationId?: string,
 *   orgType?: string,
 *   rates?: Array,
 * }} params
 * @returns {number} deposit rate (cash ÷ credit face), e.g. 0.6
 */
export function getDepositRate({
  hop,
  requesterRole,
  organizationId,
  parentOrganizationId,
  orgType,
  rates,
} = {}) {
  const card = rates ?? getDepositRates()
  return resolveDepositRate({
    rates: card,
    organizationId,
    parentOrganizationId,
    hop,
    requesterRole,
    orgType,
  }).depositRate
}

/**
 * @param {number} deposit
 * @param {number} rate
 * @returns {number}
 */
export function suggestCredits(deposit, rate) {
  const cash = Number(deposit)
  const depositRate = Number(rate)
  if (!(cash > 0) || !(depositRate > 0)) return 0
  return Math.round((cash / depositRate) * 100) / 100
}

/**
 * Deposit amount on a request (supports legacy `amount` only rows).
 * @param {object} request
 * @returns {number}
 */
export function getRequestDepositAmount(request) {
  const deposit = Number(request?.depositAmount)
  if (deposit > 0) return deposit
  return Number(request?.amount) || 0
}

/**
 * Credits shown / suggested for a request.
 * @param {object} request
 * @returns {number}
 */
export function getRequestCredits(request) {
  const released = Number(request?.creditsReleased)
  if (released > 0) return released
  const suggested = Number(request?.suggestedCredits)
  if (suggested > 0) return suggested
  const rate =
    Number(request?.depositRate) ||
    getDepositRate({
      organizationId: request?.organizationId,
      requesterRole: request?.requesterRole,
    })
  return suggestCredits(getRequestDepositAmount(request), rate)
}

export function isReleasedStatus(status) {
  return (
    status === FUNDING_STATUS.RELEASED ||
    status === FUNDING_STATUS.APPROVED ||
    status === FUNDING_STATUS.COMPLETED
  )
}

export function formatDepositRatePercent(rate) {
  const value = Number(rate)
  if (!(value > 0)) return '0%'
  const pct = Math.round(value * 1000) / 10
  return Number.isInteger(pct) ? `${pct}%` : `${pct}%`
}

/**
 * Correct formula copy: credits = deposit ÷ rate (not deposit + %).
 * @param {{ depositAmount: number, depositRate: number, credits?: number }} params
 */
export function buildSuggestedCreditsCopy({
  depositAmount,
  depositRate,
  credits,
}) {
  const rate = Number(depositRate) || 0
  const deposit = Number(depositAmount) || 0
  const suggested =
    credits != null ? Number(credits) : suggestCredits(deposit, rate)
  const pct = formatDepositRatePercent(rate)
  const exampleCredits = 1000
  const exampleDeposit = Math.round(exampleCredits * rate * 100) / 100

  return {
    headline: 'Suggested credits to release',
    formula: `${formatCurrency(deposit)} deposited ÷ ${pct} (deposit rate) = ${suggested.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credits`,
    explanation: `${pct} of credit value is paid as deposit. For example, ${exampleCredits.toLocaleString('en-PH')} credits = ${formatCurrency(exampleDeposit)}.`,
  }
}

/**
 * Soft-warn helper: another released request already used this payment reference.
 * @param {Array} requests
 * @param {string} paymentReferenceId
 * @param {string} [excludeRequestId]
 */
export function findDuplicatePaymentReference(
  requests,
  paymentReferenceId,
  excludeRequestId,
) {
  const ref = String(paymentReferenceId || '')
    .trim()
    .toLowerCase()
  if (!ref) return null
  return (
    (requests || []).find(
      (request) =>
        request.id !== excludeRequestId &&
        isReleasedStatus(request.status) &&
        String(request.paymentReferenceId || '')
          .trim()
          .toLowerCase() === ref,
    ) || null
  )
}
