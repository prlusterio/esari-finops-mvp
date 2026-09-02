/**
 * Unwired Sub-Franchisee / subfranchisor API.
 * Do not import from pages, AuthContext, or localStorage services yet.
 */

export { isApiWired } from '@/lib/api/config'
export { ApiError, isApiNotWiredError } from '@/lib/api/errors'
export { subfranchisorEndpoints } from '@/lib/api/endpoints'

export {
  getSubfranchisorMe,
  loginSubfranchisor,
  logoutSubfranchisor,
} from './auth'
export {
  listFranchiseeAccounts,
  listNetworkAccounts,
  listRetailerAccounts,
} from './accounts'
export { getWallet, listWalletActivity, listWallets } from './wallets'
export {
  createCreditRequest,
  createDirectCreditRelease,
  deleteCreditRequest,
  getCreditRequest,
  listCreditRequests,
  listCreditTransfers,
  rejectCreditRequest,
  releaseCreditRequest,
  updateCreditRequest,
} from './internetCredits'
export {
  deleteDepositRate,
  listDepositRates,
  upsertDepositRate,
} from './depositRates'
export {
  createCommissionSetting,
  listCommissionSettings,
  updateCommissionSetting,
} from './commissionSettings'
export { getSaleTransaction, listSaleTransactions } from './transactions'
export {
  listInternetCreditsEarnings,
  listSalesCommission,
} from './revenue'
export {
  exportReport,
  getFranchiseeCommissionsReport,
  getInternetCreditsEarningsReport,
  getInternetRetailerBalanceReport,
  getReportOverview,
  getRetailerCommissionsReport,
  getRevenueSharingReport,
} from './reports'
export { listNotifications, markNotificationsRead } from './notifications'
