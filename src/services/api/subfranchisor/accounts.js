import { apiGet } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').OrganizationDto} OrganizationDto
 */

/** @returns {Promise<OrganizationDto[]>} */
export function listFranchiseeAccounts() {
  return apiGet(routes.franchiseeAccounts())
}

/** @returns {Promise<OrganizationDto[]>} */
export function listRetailerAccounts() {
  return apiGet(routes.retailerAccounts())
}

/**
 * Franchisees and retailers in this sub-franchisee's network.
 * @returns {Promise<{ franchisees: OrganizationDto[], retailers: OrganizationDto[] }>}
 */
export function listNetworkAccounts() {
  return apiGet(routes.allAccounts())
}
