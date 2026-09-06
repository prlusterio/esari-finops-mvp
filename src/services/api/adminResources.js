import { apiGet, apiPost } from '@/lib/api/client'
import { ADMIN_PREFIX, resolveApiPrefix } from '@/lib/api/roles'

function join(prefix, path) {
  return `${prefix}${path}`
}

function prefixFor(role) {
  return resolveApiPrefix(role)
}

/**
 * T9b/T10 admin resources (reads proceed; writes wait on G4).
 * - GET {prefix}/collections (admin companies ledger read)
 * - POST {prefix}/collections is 503-as-expected while G4 open;
 *   callers surface the 503 instead of persisting locally when wired.
 * - GET {admin}/companies backs the Dashboard/Clients rebuild; unknown
 *   shapes pass through with []-safe defaults and fall back on 404/503.
 */
export function adminCollectionsPath(role) {
  return join(prefixFor(role), '/collections')
}

export function adminCompaniesPath() {
  return join(ADMIN_PREFIX, '/companies')
}

export function listAdminCollectionsForRole(role, query) {
  return apiGet(adminCollectionsPath(role), query)
}

export function createAdminCollectionForRole(role, payload) {
  return apiPost(adminCollectionsPath(role), payload)
}

export function adminStatusAuditPath() {
  return join(ADMIN_PREFIX, '/status-audit')
}

export function getAdminStatusAudit(query) {
  return apiGet(adminStatusAuditPath(), query)
}

export function listAdminCompaniesForRole(role, query) {
  return apiGet(role ? adminCompaniesPath() : adminCompaniesPath(), query)
}
