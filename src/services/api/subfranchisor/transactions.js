import { apiGet } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').SaleTransactionDto} SaleTransactionDto
 * @typedef {import('./types.js').DateRangeQuery} DateRangeQuery
 */

/**
 * Sales in this sub-franchisee's network (`subfranchiseeOrganizationId` scope).
 * @param {DateRangeQuery} [query]
 * @returns {Promise<SaleTransactionDto[]>}
 */
export function listSaleTransactions(query) {
  return apiGet(routes.transactions(), query)
}

/** @param {string} transactionId */
export function getSaleTransaction(transactionId) {
  return apiGet(routes.transaction(transactionId))
}
