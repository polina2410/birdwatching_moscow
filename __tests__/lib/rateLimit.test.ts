import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkRateLimit, _resetStoreForTesting } from '@/lib/rateLimit'

beforeEach(() => {
  _resetStoreForTesting()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('checkRateLimit — allowed requests', () => {
  it('returns allowed: true for the first request in the window', () => {
    expect(checkRateLimit('user-1')).toEqual({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns allowed: true at MAX_REQUESTS (second request)', () => {
    checkRateLimit('user-1')
    expect(checkRateLimit('user-1')).toEqual({ allowed: true, retryAfterSeconds: 0 })
  })
})

describe('checkRateLimit — blocked requests', () => {
  it('returns allowed: false with a positive retryAfterSeconds when over the limit', () => {
    checkRateLimit('user-1')
    checkRateLimit('user-1')
    const result = checkRateLimit('user-1')
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('retryAfterSeconds decreases as time passes within the window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    checkRateLimit('user-1')
    checkRateLimit('user-1')
    checkRateLimit('user-1') // blocked

    vi.setSystemTime(10_000)
    const result = checkRateLimit('user-1')
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(50)
  })
})

describe('checkRateLimit — fixed window (regression)', () => {
  it('a blocked client retrying repeatedly does not extend the window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    checkRateLimit('user-1')
    checkRateLimit('user-1')
    for (let i = 0; i < 10; i++) checkRateLimit('user-1') // blocked repeatedly

    vi.setSystemTime(60_001)
    expect(checkRateLimit('user-1')).toEqual({ allowed: true, retryAfterSeconds: 0 })
  })

  it('counter resets after window expiry', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    checkRateLimit('user-1')
    checkRateLimit('user-1')
    expect(checkRateLimit('user-1').allowed).toBe(false)

    vi.setSystemTime(60_001)
    expect(checkRateLimit('user-1')).toEqual({ allowed: true, retryAfterSeconds: 0 })
    expect(checkRateLimit('user-1')).toEqual({ allowed: true, retryAfterSeconds: 0 })
    expect(checkRateLimit('user-1').allowed).toBe(false)
  })
})

describe('checkRateLimit — key isolation', () => {
  it('different keys have independent counters', () => {
    checkRateLimit('user-1')
    checkRateLimit('user-1')
    checkRateLimit('user-1') // user-1 blocked

    expect(checkRateLimit('user-2')).toEqual({ allowed: true, retryAfterSeconds: 0 })
  })
})
