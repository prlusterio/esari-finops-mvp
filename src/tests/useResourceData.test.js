import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ setters: [], apiWired: true }))

vi.mock('react', () => ({
  useState: (initial) => {
    const value = typeof initial === 'function' ? initial() : initial
    const set = vi.fn()
    state.setters.push({ value, set })
    return [value, set]
  },
  useRef: (initial) => ({ current: initial }),
  useEffect: () => {},
  useCallback: (fn) => fn,
}))

vi.mock('@/lib/api/config', () => ({
  isApiWired: () => state.apiWired,
}))

const { useResourceData } = await import('@/hooks/useResourceData')

function setterAt(index) {
  return state.setters[index].set
}

describe('useResourceData fallbackEnabled:false is API-only (no storage gate)', () => {
  beforeEach(() => {
    state.setters.length = 0
    state.apiWired = true
    vi.clearAllMocks()
  })

  it('initializes wired first paint as [] + loading without flashing storage', () => {
    const storageRows = [{ mock: true }]
    const loadFromStorage = vi.fn().mockReturnValue(storageRows)

    const { data, loading } = useResourceData({
      loadFromApi: vi.fn().mockResolvedValue([]),
      loadFromStorage,
    })

    expect(data).toEqual([])
    expect(loading).toBe(true)
    expect(loadFromStorage).not.toHaveBeenCalled()
  })

  it('initializes unwired first paint from storage rows', () => {
    state.apiWired = false
    const storageRows = [{ mock: true }]
    const loadFromStorage = vi.fn().mockReturnValue(storageRows)

    const { data, loading } = useResourceData({ loadFromStorage })

    expect(data).toEqual(storageRows)
    expect(loading).toBe(true)
    expect(loadFromStorage).toHaveBeenCalledTimes(1)
  })

  it('attempts loadFromApi when wired even with fallbackEnabled:false', async () => {
    const apiRows = [{ id: 1 }]
    const loadFromApi = vi.fn().mockResolvedValue(apiRows)
    const loadFromStorage = vi.fn().mockReturnValue([{ mock: true }])

    const { reload } = useResourceData({
      loadFromApi,
      loadFromStorage,
      fallbackEnabled: false,
    })
    await reload()

    // Order of useState calls in the hook: data, loading, error, source.
    const setData = setterAt(0)
    const setSource = setterAt(3)
    expect(loadFromApi).toHaveBeenCalledTimes(1)
    expect(setData).toHaveBeenCalledWith(apiRows)
    expect(setSource).toHaveBeenCalledWith('api')
  })

  it('keeps []-safe api-error state on API failure with fallbackEnabled:false', async () => {
    const apiError = Object.assign(new Error('Unavailable'), { status: 503 })
    const loadFromApi = vi.fn().mockRejectedValue(apiError)
    const loadFromStorage = vi.fn().mockReturnValue([{ mock: true }])

    const { reload } = useResourceData({
      loadFromApi,
      loadFromStorage,
      fallbackEnabled: false,
    })
    const result = await reload()

    const setData = setterAt(0)
    const setError = setterAt(2)
    const setSource = setterAt(3)
    expect(result).toEqual([])
    expect(setData).toHaveBeenCalledWith([])
    expect(setError).toHaveBeenCalledWith(apiError)
    expect(setSource).toHaveBeenCalledWith('api-error')
  })
})
