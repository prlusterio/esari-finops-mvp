import { apiGet } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'

/**
 * @typedef {import('./types.js').WalletDto} WalletDto
 */

/** @returns {Promise<WalletDto[]>} */
export function listWallets() {
  return apiGet(routes.wallets())
}

/** @param {string} walletId */
export function getWallet(walletId) {
  return apiGet(routes.wallet(walletId))
}

/** @param {string} walletId */
export function listWalletActivity(walletId) {
  return apiGet(routes.walletActivity(walletId))
}
