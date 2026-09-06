import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { apiErrorMessage, toRows } from '@/hooks/useResourceData'

function mockFetchOnce({ status = 200, body = {}, contentType = 'application/json' }) {
  const response = new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    { status, headers: { 'content-type': contentType } },
  )
  globalThis.fetch = vi.fn().mockResolvedValue(response)
  return globalThis.fetch
}

describe('spec 02 §17 envelope: success/data unwrap + API_ERROR + HTTP states', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:5173')
    vi.restoreAllMocks()
  })

  it('unwraps { success:true, data } payloads', async () => {
    mockFetchOnce({ body: { success: true, message: 'ok', data: [1, 2, 3] } })
    const { apiGet } = await import('@/lib/api/client')
    await expect(apiGet('/api/v1/subfranchisor/wallets')).resolves.toEqual([1, 2, 3])
  })

  it('throws API_ERROR on success:false envelopes', async () => {
    mockFetchOnce({ body: { success: false, message: 'Nope.', data: null } })
    const { apiGet } = await import('@/lib/api/client')
    const call = apiGet('/api/v1/subfranchisor/wallets')
    await expect(call).rejects.toMatchObject({ code: 'API_ERROR', message: 'Nope.' })
  })

  it('maps 401/403/422/503 to ApiError states for []-safe pages', async () => {
    const { apiGet } = await import('@/lib/api/client')
    mockFetchOnce({ status: 401, body: { message: 'Unauthenticated.' } })
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 401 })
    mockFetchOnce({ status: 403, body: { message: 'Forbidden.' } })
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 403 })
    mockFetchOnce({
      status: 422,
      body: { message: 'The reason field is required.', errors: { reason: ['required'] } },
    })
    const error = await apiGet('/x').catch((err) => err)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(422)
    expect(apiErrorMessage(error)).toMatch('required')
    mockFetchOnce({ status: 503, body: { message: 'Disabled until G4.' } })
    await expect(apiGet('/x')).rejects.toMatchObject({ status: 503 })
    expect(apiErrorMessage({ status: 503 })).toMatch('temporarily unavailable')
  })

  it('toRows stays []-safe on empty/null/missing payloads', () => {
    expect(toRows([])).toEqual([])
    expect(toRows(null)).toEqual([])
    expect(toRows(undefined)).toEqual([])
    expect(toRows({})).toEqual([])
    expect(toRows({ data: [1] })).toEqual([1])
    expect(toRows({ items: [2] })).toEqual([2])
  })
})
