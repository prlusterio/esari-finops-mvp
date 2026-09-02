import { apiGet, apiPost, apiPut } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').CommissionSettingDto} CommissionSettingDto
 */

/**
 * @param {{ retailerId?: string, franchiseeId?: string, status?: string }} [query]
 * @returns {Promise<CommissionSettingDto[]>}
 */
export function listCommissionSettings(query) {
  return apiGet(routes.commissionSettings(), query)
}

/**
 * Sub may set retailer, franchisee, and own share. Platform fee is Admin-owned.
 * @param {{
 *   retailerOrganizationId: string,
 *   retailerPercentage: number,
 *   franchiseePercentage: number,
 *   subfranchiseePercentage: number,
 *   effectiveDate: string,
 *   status: 'active'|'inactive',
 * }} payload
 */
export function createCommissionSetting(payload) {
  return apiPost(routes.commissionSettings(), payload)
}

/**
 * @param {string} settingId
 * @param {{
 *   retailerPercentage: number,
 *   franchiseePercentage: number,
 *   subfranchiseePercentage: number,
 *   effectiveDate?: string,
 *   status?: 'active'|'inactive',
 * }} payload
 */
export function updateCommissionSetting(settingId, payload) {
  return apiPut(routes.commissionSetting(settingId), payload)
}
