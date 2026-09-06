import { apiGet, apiPost } from '@/lib/api/client'
import { resolveApiPrefix } from '@/lib/api/roles'
import { subfranchisorEndpoints } from '@/lib/api/endpoints'

function join(prefix, path) {
  return `${prefix}${path}`
}

/**
 * Role-scoped generic resource client. Subfranchisee keeps the hand-built
 * `subfranchisorEndpoints` map (path parity with the backend contract);
 * other roles reuse the same relative paths under their own prefix.
 */
function scoped(pathBuilder, role) {
  const prefix = resolveApiPrefix(role)
  const sub = pathBuilder()
  const relative = sub.replace(/^\/api\/v1\/subfranchisor/, '')
  if (prefix === sub.slice(0, prefix.length)) return sub
  return join(prefix, relative)
}

function accountsPath(role, which) {
  if (which === 'franchisees') return scoped(subfranchisorEndpoints.franchiseeAccounts, role)
  if (which === 'retailers') return scoped(subfranchisorEndpoints.retailerAccounts, role)
  return scoped(subfranchisorEndpoints.allAccounts, role)
}

export function listAccountsForRole(role, query) {
  return apiGet(accountsPath(role, 'all'), query)
}

export function listFranchiseeAccountsForRole(role, query) {
  return apiGet(accountsPath(role, 'franchisees'), query)
}

export function listRetailerAccountsForRole(role, query) {
  return apiGet(accountsPath(role, 'retailers'), query)
}

export function listWalletsForRole(role, query) {
  return apiGet(scoped(subfranchisorEndpoints.wallets, role), query)
}

export function getWalletForRole(role, walletId) {
  return apiGet(scoped(() => subfranchisorEndpoints.wallet(walletId), role))
}

export function listWalletActivityForRole(role, walletId, query) {
  return apiGet(scoped(() => subfranchisorEndpoints.walletActivity(walletId), role), query)
}

export function listCreditRequestsForRole(role, query) {
  return apiGet(scoped(subfranchisorEndpoints.creditRequests, role), query)
}

export function createCreditRequestForRole(role, payload) {
  return apiPost(scoped(subfranchisorEndpoints.creditRequests, role), payload)
}

export function releaseCreditRequestForRole(role, requestId, payload) {
  return apiPost(scoped(() => subfranchisorEndpoints.releaseCreditRequest(requestId), role), payload)
}

export function rejectCreditRequestForRole(role, requestId, payload) {
  return apiPost(scoped(() => subfranchisorEndpoints.rejectCreditRequest(requestId), role), payload)
}

export function createDirectCreditReleaseForRole(role, payload) {
  return apiPost(scoped(subfranchisorEndpoints.directCreditReleases, role), payload)
}

export function listCreditTransfersForRole(role, query) {
  return apiGet(scoped(subfranchisorEndpoints.creditTransfers, role), query)
}

export function listDepositRatesForRole(role) {
  return apiGet(scoped(subfranchisorEndpoints.depositRates, role))
}

export function listCommissionSettingsForRole(role, query) {
  return apiGet(scoped(subfranchisorEndpoints.commissionSettings, role), query)
}

export function listSaleTransactionsForRole(role, query) {
  return apiGet(scoped(subfranchisorEndpoints.transactions, role), query)
}

export function listSalesCommissionForRole(role, query) {
  return apiGet(scoped(subfranchisorEndpoints.salesCommission, role), query)
}

export function listInternetCreditsEarningsForRole(role, query) {
  return apiGet(scoped(subfranchisorEndpoints.internetCreditsEarnings, role), query)
}

export function getReportForRole(role, slug, query) {
  return apiGet(scoped(() => subfranchisorEndpoints.exportReport(slug).replace('/export', ''), role), query)
}

export async function exportReportCsvForRole(role, slug, query) {
  const path = scoped(() => subfranchisorEndpoints.exportReport(slug), role)
  const { getApiBaseUrl, getStoredApiToken } = await import('@/lib/api/config')
  const params = new URLSearchParams()
  Object.entries({ ...(query || {}), format: 'csv' }).forEach(([key, value]) => {
    if (value == null || value === '') return
    params.set(key, String(value))
  })
  const url = `${getApiBaseUrl()}${path}?${params.toString()}`
  const response = await fetch(url, {
    headers: {
      Accept: 'text/csv',
      ...(getStoredApiToken() ? { Authorization: `Bearer ${getStoredApiToken()}` } : {}),
      'X-Requested-With': 'XMLHttpRequest',
    },
    credentials: 'include',
  })
  if (!response.ok) {
    const { ApiError } = await import('@/lib/api/errors')
    throw new ApiError({ status: response.status, message: response.statusText || 'Export failed.' })
  }
  return response.blob()
}

export function listNotificationsForRole(role) {
  return apiGet(scoped(subfranchisorEndpoints.notifications, role))
}

export function markNotificationsReadForRole(role, payload) {
  return apiPost(scoped(subfranchisorEndpoints.markNotificationsRead, role), payload)
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
