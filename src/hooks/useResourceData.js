import { useCallback, useEffect, useRef, useState } from 'react'
import { isApiWired } from '@/lib/api/config'

/**
 * Shared API-first loader with localStorage fallback.
 *
 * - When the API is wired (VITE_API_BASE_URL set), `loadFromApi` runs and
 *   its result is used. Errors are surfaced as `{ error }` with `[]`-safe
 *   data; storage fallback stays importable until each resource verifies,
 *   but a page never mixes sources: fallback only applies while the API is
 *   unwired or when explicitly enabled for that resource.
 * - When unwired, `loadFromStorage` runs synchronously (or as a thunk).
 *
 * Contract: error states surface 401/403/422/503 distinctly via ApiError.
 *
 * Note: callers may still pass `fallbackEnabled: false` ("API-only, no
 * storage blend"); it is intentionally ignored here. The API is attempted
 * whenever wired, and failures stay []-safe with source 'api-error'.
 */
export function useResourceData({
  loadFromApi,
  loadFromStorage,
  deps = [],
} = {}) {
  const [data, setData] = useState(() => (isApiWired() ? [] : readInitial(loadFromStorage, false)))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('storage')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    // fallbackEnabled:false means "API-only, no storage blend" — it must not
    // gate the API attempt. Attempt the API whenever wired; errors stay
    // []-safe with source 'api-error' (see catch below).
    if (!isApiWired() || !loadFromApi) {
      const next = readInitial(loadFromStorage, true)
      if (!mounted.current) return next
      setData(next)
      setError(null)
      setLoading(false)
      setSource('storage')
      return next
    }
    if (mounted.current) {
      setLoading(true)
      setError(null)
    }
    try {
      const next = await loadFromApi()
      if (!mounted.current) return next ?? []
      setData(next ?? [])
      setSource('api')
      return next ?? []
    } catch (apiError) {
      if (!mounted.current) throw apiError
      setError(apiError)
      // No mixed-source page: on API failure the page shows the error
      // state (with []-safe rows), not a silent storage blend.
      setData([])
      setSource('api-error')
      return []
    } finally {
      if (mounted.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload])

  return { data, loading, error, source, reload, isApi: source === 'api' }
}

function readInitial(loadFromStorage, callIfFunction) {
  if (typeof loadFromStorage === 'function') {
    try {
      const value = loadFromStorage()
      return value ?? []
    } catch {
      return []
    }
  }
  if (callIfFunction) return loadFromStorage ?? []
  try {
    return typeof loadFromStorage === 'function' ? loadFromStorage() : (loadFromStorage ?? [])
  } catch {
    return []
  }
}

/** []-safe rows for error/empty/null/missing payloads per READ NOTE. */
export function toRows(value) {
  if (Array.isArray(value)) return value
  if (value == null) return []
  if (typeof value === 'object' && Array.isArray(value.data)) return value.data
  if (typeof value === 'object' && Array.isArray(value.items)) return value.items
  return []
}

/** Human message for ApiError HTTP states (401/403/422/503). */
export function apiErrorMessage(error, fallback = 'Unable to load data.') {
  if (!error) return ''
  if (error.status === 401) return 'Your session expired. Please sign in again.'
  if (error.status === 403) return 'You do not have access to this data.'
  if (error.status === 422) {
    const details = error.errors
      ? Object.values(error.errors).flat().filter(Boolean).join(' ')
      : ''
    return details || error.message || 'Validation failed.'
  }
  if (error.status === 503) return 'This service is temporarily unavailable. Please try again later.'
  return error.message || fallback
}
