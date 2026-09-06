import { apiGet, apiPost } from '@/lib/api/client'
import { clearApiToken, storeApiToken } from '@/lib/api/config'
import { ADMIN_PREFIX, FRANCHISEE_PREFIX, RETAILER_PREFIX, resolveApiPrefix } from '@/lib/api/roles'
import { subfranchisorEndpoints } from '@/lib/api/endpoints'

function prefixJoin(prefix, path) {
  return `${prefix}${path}`
}

/**
 * Per-role auth clients. Each role hits its own namespace prefix:
 * admin → /api/v1/admin, subfranchisee → /api/v1/subfranchisor,
 * franchisee → /api/v1/franchisee, retailer → /api/v1/retailer.
 *
 * Auth paths mirror the subfranchisor contract (login/logout/me);
 * role-specific namespaces reuse the same relative paths.
 */

export function loginPathForRole(role) {
  const prefix = resolveApiPrefix(role)
  if (prefix === ADMIN_PREFIX) return prefixJoin(prefix, '/login')
  if (prefix === FRANCHISEE_PREFIX) return prefixJoin(prefix, '/login')
  if (prefix === RETAILER_PREFIX) return prefixJoin(prefix, '/login')
  return subfranchisorEndpoints.login()
}

export function logoutPathForRole(role) {
  const prefix = resolveApiPrefix(role)
  if (prefix === ADMIN_PREFIX) return prefixJoin(prefix, '/logout')
  if (prefix === FRANCHISEE_PREFIX) return prefixJoin(prefix, '/logout')
  if (prefix === RETAILER_PREFIX) return prefixJoin(prefix, '/logout')
  return subfranchisorEndpoints.logout()
}

export function mePathForRole(role) {
  const prefix = resolveApiPrefix(role)
  if (prefix === ADMIN_PREFIX) return prefixJoin(prefix, '/me')
  if (prefix === FRANCHISEE_PREFIX) return prefixJoin(prefix, '/me')
  if (prefix === RETAILER_PREFIX) return prefixJoin(prefix, '/me')
  return subfranchisorEndpoints.me()
}

/**
 * Map backend SessionUserDto ({id,...}) onto the frontend session shape
 * ({userId,...}). `userId` (frontend session key) vs `id` (DTO field)
 * stay distinct — never renamed to match.
 */
export function toSessionUser(dto) {
  if (!dto || typeof dto !== 'object') return null
  return {
    userId: dto.id ?? dto.userId ?? null,
    name: dto.name ?? '',
    email: dto.email ?? '',
    role: dto.role ?? '',
    organizationId: dto.organizationId ?? dto.organization_id ?? null,
    status: dto.status,
  }
}

/**
 * @param {string} role UI role (subfranchisee maps to subfranchisor namespace)
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function loginForRole(role, credentials) {
  const data = await apiPost(loginPathForRole(role), credentials)
  if (data?.token) storeApiToken(data.token)
  const user = toSessionUser(data?.user ?? data)
  return { user, token: data?.token, raw: data }
}

/** Best-effort logout per role; token is always cleared (matches spec 04 public no-op). */
export async function logoutForRole(role) {
  try {
    await apiPost(logoutPathForRole(role), {})
  } finally {
    clearApiToken()
  }
}

/** @returns {Promise<object>} frontend-shaped session user */
export async function meForRole(role) {
  const data = await apiGet(mePathForRole(role))
  return toSessionUser(data?.user ?? data)
}
