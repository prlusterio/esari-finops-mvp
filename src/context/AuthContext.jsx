import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authService from '@/services/auth'
import { getOrganizations } from '@/services/storage'
import { initializeMockData, resetDemoData as seedResetDemoData } from '@/data/seed'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [ready, setReady] = useState(false)

  const refreshOrganization = useCallback((organizationId) => {
    if (!organizationId) {
      setOrganization(null)
      return
    }
    const orgs = getOrganizations()
    setOrganization(orgs.find((org) => org.id === organizationId) || null)
  }, [])

  const refreshSession = useCallback(() => {
    const current = authService.getCurrentUser()
    setUser(current)
    refreshOrganization(current?.organizationId)
    return current
  }, [refreshOrganization])

  useEffect(() => {
    initializeMockData()
    refreshSession()
    setReady(true)
  }, [refreshSession])

  const login = useCallback((email, password) => {
    const result = authService.login(email, password)
    if (result.success) {
      setUser(result.user)
      refreshOrganization(result.user.organizationId)
    }
    return result
  }, [refreshOrganization])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
    setOrganization(null)
  }, [])

  const resetDemoData = useCallback(() => {
    const current = authService.getCurrentUser()
    seedResetDemoData()

    if (current) {
      const restored = authService.getCurrentUser()
      if (!restored) {
        // Session user no longer valid after reset — clear session
        authService.logout()
        setUser(null)
        setOrganization(null)
      } else {
        setUser(restored)
        refreshOrganization(restored.organizationId)
      }
    }

    setDataVersion((version) => version + 1)
  }, [refreshOrganization])

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
      login,
      logout,
      resetDemoData,
      refreshSession,
      bumpDataVersion,
    }),
    [
      user,
      organization,
      ready,
      dataVersion,
      login,
      logout,
      resetDemoData,
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
