import { apiDelete, apiGet, apiPut } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').DepositRateDto} DepositRateDto
 */

/** @returns {Promise<DepositRateDto[]>} */
export function listDepositRates() {
  return apiGet(routes.depositRates())
}

/**
 * Override the Sub → Franchisee hop rate for one downline.
 * @param {string} organizationId
 * @param {{ depositRate: number, reason?: string }} payload
 */
export function upsertDepositRate(organizationId, payload) {
  return apiPut(routes.depositRate(organizationId), payload)
}

/** @param {string} organizationId */
export function deleteDepositRate(organizationId) {
  return apiDelete(routes.depositRate(organizationId))
}
