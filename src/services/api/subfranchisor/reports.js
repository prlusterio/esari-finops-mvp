import { apiGet } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').DateRangeQuery} DateRangeQuery
 */

/** @param {DateRangeQuery} [query] */
export function getReportOverview(query) {
  return apiGet(routes.reportOverview(), query)
}

/** @param {DateRangeQuery} [query] */
export function getRevenueSharingReport(query) {
  return apiGet(routes.reportRevenueSharing(), query)
}

/** @param {DateRangeQuery} [query] */
export function getFranchiseeCommissionsReport(query) {
  return apiGet(routes.reportFranchiseeCommissions(), query)
}

/** @param {DateRangeQuery} [query] */
export function getRetailerCommissionsReport(query) {
  return apiGet(routes.reportRetailerCommissions(), query)
}

/** @param {DateRangeQuery} [query] */
export function getInternetCreditsEarningsReport(query) {
  return apiGet(routes.reportInternetCreditsEarnings(), query)
}

/** @param {DateRangeQuery & { retailerId?: string }} [query] */
export function getInternetRetailerBalanceReport(query) {
  return apiGet(routes.reportInternetRetailerBalance(), query)
}

/**
 * CSV export for a report slug.
 * @param {'transactions'|'revenue-sharing'|'sales-commission'|'internet-credits-earnings'|'internet-retailer-balance'} slug
 * @param {DateRangeQuery} [query]
 */
export function exportReport(slug, query) {
  return apiGet(routes.exportReport(slug), { ...query, format: 'csv' })
}
