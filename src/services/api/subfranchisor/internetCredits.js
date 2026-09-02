import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').CreditRequestDto} CreditRequestDto
 * @typedef {import('./types.js').CreditTransferDto} CreditTransferDto
 * @typedef {import('./types.js').DateRangeQuery} DateRangeQuery
 */

/**
 * Incoming franchisee requests plus this org's requests to Admin.
 * @param {DateRangeQuery & { scope?: 'incoming'|'mine'|'approved'|'all', status?: string }} [query]
 * @returns {Promise<CreditRequestDto[]>}
 */
export function listCreditRequests(query) {
  return apiGet(routes.creditRequests(), query)
}

/** @param {string} requestId */
export function getCreditRequest(requestId) {
  return apiGet(routes.creditRequest(requestId))
}

/**
 * Sub requests credits from Admin (`admin_to_sub` hop).
 * @param {{
 *   amount: number,
 *   notes?: string,
 *   proofOfPayment?: object | null,
 *   depositRate?: number,
 * }} payload
 */
export function createCreditRequest(payload) {
  return apiPost(routes.creditRequests(), payload)
}

/**
 * @param {string} requestId
 * @param {{ amount: number, notes?: string, proofOfPayment?: object | null }} payload
 */
export function updateCreditRequest(requestId, payload) {
  return apiPut(routes.creditRequest(requestId), payload)
}

/** @param {string} requestId */
export function deleteCreditRequest(requestId) {
  return apiDelete(routes.creditRequest(requestId))
}

/**
 * Release credits to a franchisee from Available Credits (`releaseSource: balance`).
 * @param {string} requestId
 * @param {{ creditsToRelease: number, paymentReferenceId: string }} payload
 */
export function releaseCreditRequest(requestId, payload) {
  return apiPost(routes.releaseCreditRequest(requestId), payload)
}

/**
 * @param {string} requestId
 * @param {{ reason: string }} payload
 */
export function rejectCreditRequest(requestId, payload) {
  return apiPost(routes.rejectCreditRequest(requestId), payload)
}

/**
 * Immediate release to a franchisee, no pending request.
 * @param {{
 *   toOrganizationId: string,
 *   amount: number,
 *   paymentReferenceId: string,
 *   notes?: string,
 *   proofOfPayment?: object | null,
 * }} payload
 */
export function createDirectCreditRelease(payload) {
  return apiPost(routes.directCreditReleases(), payload)
}

/** @param {DateRangeQuery} [query] */
export function listCreditTransfers(query) {
  return apiGet(routes.creditTransfers(), query)
}
