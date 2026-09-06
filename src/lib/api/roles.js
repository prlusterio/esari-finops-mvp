import { API_VERSION_PREFIX, SUBFRANCHISOR_PREFIX } from '@/lib/api/config'
import { ROLES } from '@/lib/constants'

export const ADMIN_PREFIX = `${API_VERSION_PREFIX}/admin`
export const FRANCHISEE_PREFIX = `${API_VERSION_PREFIX}/franchisee`
export const RETAILER_PREFIX = `${API_VERSION_PREFIX}/retailer`

/**
 * UI role `subfranchisee` maps to backend namespace `subfranchisor`.
 * All other roles map 1:1 to their namespace.
 */
export function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase()
  if (value === 'subfranchisee' || value === 'subfranchisor') return ROLES.SUBFRANCHISEE
  if (value === ROLES.ADMIN) return ROLES.ADMIN
  if (value === ROLES.FRANCHISEE) return ROLES.FRANCHISEE
  if (value === ROLES.RETAILER) return ROLES.RETAILER
  return value || ''
}

export function backendNamespaceForRole(role) {
  const normalized = normalizeRole(role)
  if (normalized === ROLES.SUBFRANCHISEE) return 'subfranchisor'
  return normalized
}

export function resolveApiPrefix(role) {
  const normalized = normalizeRole(role)
  if (normalized === ROLES.ADMIN) return ADMIN_PREFIX
  if (normalized === ROLES.FRANCHISEE) return FRANCHISEE_PREFIX
  if (normalized === ROLES.RETAILER) return RETAILER_PREFIX
  return SUBFRANCHISOR_PREFIX
}

export function isKnownRole(role) {
  return [ROLES.ADMIN, ROLES.SUBFRANCHISEE, ROLES.FRANCHISEE, ROLES.RETAILER].includes(
    normalizeRole(role),
  )
}
