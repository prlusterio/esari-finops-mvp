import { SUBFRANCHISOR_PREFIX } from '@/lib/api/config'

function join(path) {
  return `${SUBFRANCHISOR_PREFIX}${path}`
}

/**
 * Canonical Sub-Franchisee / subfranchisor routes for the finops module.
 * Existing admin-v3 auth + accounts paths are reused. FinOps-only resources
 * are proposed under the same `/api/v1/subfranchisor` prefix.
 */
export const subfranchisorEndpoints = {
  login: () => join('/login'),
  logout: () => join('/logout'),
  me: () => join('/me'),

  franchiseeAccounts: () => join('/accounts/franchisees'),
  retailerAccounts: () => join('/accounts/retailers'),
  allAccounts: () => join('/accounts/all'),

  wallets: () => join('/wallets'),
  wallet: (walletId) => join(`/wallets/${walletId}`),
  walletActivity: (walletId) => join(`/wallets/${walletId}/activity`),

  creditRequests: () => join('/internet-credits/requests'),
  creditRequest: (requestId) => join(`/internet-credits/requests/${requestId}`),
  releaseCreditRequest: (requestId) =>
    join(`/internet-credits/requests/${requestId}/release`),
  rejectCreditRequest: (requestId) =>
    join(`/internet-credits/requests/${requestId}/reject`),
  directCreditReleases: () => join('/internet-credits/direct-releases'),
  creditTransfers: () => join('/internet-credits/transfers'),

  depositRates: () => join('/deposit-rates'),
  depositRate: (organizationId) => join(`/deposit-rates/${organizationId}`),

  commissionSettings: () => join('/commission-settings'),
  commissionSetting: (settingId) => join(`/commission-settings/${settingId}`),

  transactions: () => join('/transactions'),
  transaction: (transactionId) => join(`/transactions/${transactionId}`),

  salesCommission: () => join('/revenue/sales-commission'),
  internetCreditsEarnings: () => join('/revenue/internet-credits'),

  reportOverview: () => join('/reports/overview'),
  reportRevenueSharing: () => join('/reports/revenue-sharing'),
  reportFranchiseeCommissions: () => join('/reports/franchisee-commissions'),
  reportRetailerCommissions: () => join('/reports/retailer-commissions'),
  reportInternetCreditsEarnings: () =>
    join('/reports/internet-credits-earnings'),
  reportInternetRetailerBalance: () =>
    join('/reports/internet-retailer-balance'),
  exportReport: (slug) => join(`/reports/${slug}/export`),

  notifications: () => join('/notifications'),
  markNotificationsRead: () => join('/notifications/read'),
}
