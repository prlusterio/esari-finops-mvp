import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '@/services/auth'
import { getOrganizations } from '@/services/storage'
import { initializeMockData } from '@/data/seed'
import { isApiWired, getStoredApiToken, clearApiToken } from '@/lib/api/config'
import { normalizeRole, isKnownRole } from '@/lib/api/roles'
import { loginForRole, logoutForRole, meForRole } from '@/services/api/authClients'

const AuthContext = createContext(null)

/**
 * T2 auth swap: when VITE_API_BASE_URL is set (isApiWired), login/logout/me
 * go through per-role API clients with the Bearer token in `api_token`.
 * Storage login stays as fallback behind VITE_AUTH_FALLBACK (default on
 * during the T3–T10 row-by-row swaps, off after T11 mock retirement).
 */
export function isStorageAuthFallbackEnabled() {
  const raw = String(import.meta.env.VITE_AUTH_FALLBACK ?? 'true').toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'no'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState('')

  const refreshOrganization = useCallback((organizationId) => {
    if (!organizationId) {
      setOrganization(null)
      return
    }
    const orgs = getOrganizations()
    setOrganization(orgs.find((org) => org.id === organizationId) || null)
  }, [])

  const refreshSession = useCallback(async () => {
    // API-first when wired + token present: verify via per-role /me.
    if (isApiWired() && getStoredApiToken()) {
      try {
        const stored = authService.getCurrentUser()
        const probes = [stored?.role, 'subfranchisee', 'admin', 'franchisee', 'retailer'].filter(Boolean)
        let verified = null
        let lastError = null
        for (const role of probes) {
          try {
            const me = await meForRole(role)
            if (me) {
              verified = { ...me, role: normalizeRole(me.role || role) }
              break
            }
          } catch (error) {
            lastError = error
            if (error?.status === 401 || error?.status === 403) continue
            break
          }
        }
        if (verified) {
          setUser(verified)
          refreshOrganization(verified.organizationId)
          return verified
        }
        if (lastError?.status === 401) {
          clearApiToken()
          authService.logout()
          setUser(null)
          setOrganization(null)
          return null
        }
      } catch {
        // Fall through to storage session when the API is unreachable.
      }
    }
    const current = authService.getCurrentUser()
    setUser(current)
    refreshOrganization(current?.organizationId)
    return current
  }, [refreshOrganization])

  useEffect(() => {
    initializeMockData()
    refreshSession().finally(() => setReady(true))
  }, [refreshSession])

  const login = useCallback(
    async (email, password) => {
      setAuthError('')
      if (isApiWired()) {
        // Role is unknown before login: try each namespace in order.
        // Wrong credentials surface as the last 401 message.
        const roles = ['subfranchisee', 'admin', 'franchisee', 'retailer']
        let lastError = null
        for (const role of roles) {
          try {
            const { user: sessionUser } = await loginForRole(role, { email, password })
            if (sessionUser) {
              const normalized = { ...sessionUser, role: normalizeRole(sessionUser.role || role) }
              if (!isKnownRole(normalized.role)) continue
              try {
                const me = await meForRole(normalized.role)
                if (me) {
                  normalized.userId = me.userId ?? normalized.userId
                  normalized.organizationId = me.organizationId ?? normalized.organizationId
                  normalized.name = me.name || normalized.name
                }
              } catch {
                // /me verify is best-effort; login token still stands.
              }
              setUser(normalized)
              refreshOrganization(normalized.organizationId)
              return { success: true, user: normalized }
            }
          } catch (error) {
            lastError = error
            if (error?.code === 'API_NOT_WIRED' || error?.code === 'NETWORK_ERROR') break
            if (error?.status === 401 || error?.status === 422) continue
            break
          }
        }
        if (
          lastError?.code !== 'NETWORK_ERROR' &&
          lastError?.code !== 'API_NOT_WIRED' &&
          lastError?.status !== 0
        ) {
          const message =
            lastError?.status === 422
              ? 'Invalid email or password.'
              : lastError?.message || 'Invalid email or password.'
          if (!isStorageAuthFallbackEnabled()) {
            setAuthError(message)
            return { success: false, error: message }
          }
          // Fall through to storage fallback when enabled (T3–T10 swaps).
        } else if (!isStorageAuthFallbackEnabled()) {
          const message = lastError?.message || 'Unable to reach the API.'
          setAuthError(message)
          return { success: false, error: message }
        }
      }
      const result = authService.login(email, password)
      if (result.success) {
        setUser(result.user)
        refreshOrganization(result.user.organizationId)
      }
      return result
    },
    [refreshOrganization],
  )

  const logout = useCallback(async () => {
    if (isApiWired() && getStoredApiToken()) {
      try {
        await logoutForRole(user?.role || 'subfranchisee')
      } catch {
        clearApiToken()
      }
    }
    authService.logout()
    setUser(null)
    setOrganization(null)
  }, [user?.role])

  const bumpDataVersion = useCallback(() => {
    setDataVersion((version) => version + 1)
  }, [])

  const value = useMemo(
    () => ({
      user,
      organization,
      ready,
      isAuthenticated: Boolean(user),
      dataVersion,
      authError,
      login,
      logout,
      refreshSession,
      bumpDataVersion,
    }),
    [
      user,
      organization,
      ready,
      dataVersion,
      authError,
      login,
      logout,
      refreshSession,
      bumpDataVersion,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
