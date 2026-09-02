import {
  getApiBaseUrl,
  getStoredApiToken,
  isApiWired,
} from '@/lib/api/config'
import { ApiError } from '@/lib/api/errors'

function compactQuery(query = {}) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === '') return
    params.set(key, String(value))
  })
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

function unwrapEnvelope(payload, status) {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (!payload.success) {
      throw new ApiError({
        status,
        message: payload.message || 'Request failed.',
        data: payload.data ?? null,
        errors: payload.errors ?? null,
        code: payload.code || 'API_ERROR',
      })
    }
    return payload.data
  }
  return payload
}

/**
 * Low-level JSON client. Throws `ApiError` with code `API_NOT_WIRED`
 * until `VITE_API_BASE_URL` is set. Pages must not call this yet.
 *
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path
 * @param {{ query?: Record<string, unknown>, body?: unknown, signal?: AbortSignal }} [options]
 */
export async function apiRequest(method, path, options = {}) {
  const baseUrl = getApiBaseUrl()
  if (!isApiWired()) {
    throw new ApiError({
      status: 0,
      code: 'API_NOT_WIRED',
      message:
        'Sub-Franchisee API is defined but not wired. Set VITE_API_BASE_URL to connect the backend. The app still uses localStorage.',
    })
  }

  const url = `${baseUrl}${path}${compactQuery(options.query)}`
  const headers = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  const token = getStoredApiToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const init = {
    method,
    headers,
    credentials: 'include',
    signal: options.signal,
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }

  let response
  try {
    response = await fetch(url, init)
  } catch (error) {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network error.',
    })
  }

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : await response.text()

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      message:
        (payload && typeof payload === 'object' && payload.message) ||
        response.statusText ||
        'Request failed.',
      data: payload && typeof payload === 'object' ? payload.data ?? payload : payload,
      errors:
        payload && typeof payload === 'object'
          ? payload.errors ?? null
          : null,
      code: response.status === 401 ? 'UNAUTHENTICATED' : 'HTTP_ERROR',
    })
  }

  return unwrapEnvelope(payload, response.status)
}

export function apiGet(path, query, options = {}) {
  return apiRequest('GET', path, { ...options, query })
}

export function apiPost(path, body, options = {}) {
  return apiRequest('POST', path, { ...options, body })
}

export function apiPut(path, body, options = {}) {
  return apiRequest('PUT', path, { ...options, body })
}

export function apiPatch(path, body, options = {}) {
  return apiRequest('PATCH', path, { ...options, body })
}

export function apiDelete(path, options = {}) {
  return apiRequest('DELETE', path, options)
}
