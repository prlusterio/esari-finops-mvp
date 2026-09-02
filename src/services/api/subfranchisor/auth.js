import { apiGet, apiPost } from '@/lib/api/client'
import { subfranchisorEndpoints as routes } from '@/lib/api/endpoints'
import { storeApiToken, clearApiToken } from '@/lib/api/config'

/**
 * @typedef {import('./types.js').SessionUserDto} SessionUserDto
 */

/**
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ user: SessionUserDto, token: string, tokenType?: string, expiresAt?: string }>}
 */
export async function loginSubfranchisor(credentials) {
  const data = await apiPost(routes.login(), credentials)
  if (data?.token) storeApiToken(data.token)
  return data
}

export async function logoutSubfranchisor() {
  try {
    await apiPost(routes.logout(), {})
  } finally {
    clearApiToken()
  }
}

/** @returns {Promise<SessionUserDto>} */
export function getSubfranchisorMe() {
  return apiGet(routes.me())
}
