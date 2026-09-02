import { apiGet } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').DateRangeQuery} DateRangeQuery
 */

/** @param {DateRangeQuery} [query] */
export function listSalesCommission(query) {
  return apiGet(routes.salesCommission(), query)
}

/** @param {DateRangeQuery} [query] */
export function listInternetCreditsEarnings(query) {
  return apiGet(routes.internetCreditsEarnings(), query)
}
