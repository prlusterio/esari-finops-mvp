/**
 * HTTP config for the future Sub-Franchisee backend.
 * Pages still use localStorage. Do not import this from UI until wiring.
 *
 * Conventions follow esarisari-admin-v3:
 * - `/api/v1` prefix
 * - `{ success, message, data }` JSON envelope
 * - Sanctum Bearer token in `api_token`
 */

export const API_VERSION_PREFIX = '/api/v1'

/** Backend namespace is `subfranchisor`; the MVP role remains `subfranchisee`. */
export const SUBFRANCHISOR_PREFIX = `${API_VERSION_PREFIX}/subfranchisor`

/** Matches admin-v3 `localStorage.api_token`. Unused until login is wired. */
export const API_TOKEN_STORAGE_KEY = 'api_token'

export function getApiBaseUrl() {
  const raw = String(import.meta.env.VITE_API_BASE_URL || '').trim()
  return raw.replace(/\/+$/, '')
}

/** True only when a backend origin is configured. */
export function isApiWired() {
  return Boolean(getApiBaseUrl())
}

export function getStoredApiToken() {
  if (typeof window === 'undefined') return ''
  return String(window.localStorage.getItem(API_TOKEN_STORAGE_KEY) || '')
}

export function storeApiToken(token) {
  if (typeof window === 'undefined') return
  if (!token) {
    window.localStorage.removeItem(API_TOKEN_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(API_TOKEN_STORAGE_KEY, String(token))
}

export function clearApiToken() {
  storeApiToken('')
}
