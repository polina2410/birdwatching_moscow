import { describe, it, expect, vi, beforeEach } from 'vitest'

const { redisMock, pipelineMock } = vi.hoisted(() => {
  const pipelineMock = {
    incr: vi.fn(),
    exec: vi.fn(),
  }
  return {
    redisMock: {
      pipeline: vi.fn(() => pipelineMock),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(30),
    },
    pipelineMock,
  }
})

vi.mock('@/lib/redis', () => ({ redis: redisMock }))

import { checkRateLimit } from '@/lib/rateLimit'

beforeEach(() => {
  vi.clearAllMocks()
  redisMock.pipeline.mockReturnValue(pipelineMock)
  redisMock.expire.mockResolvedValue(1)
  redisMock.ttl.mockResolvedValue(30)
})

describe('checkRateLimit — allowed requests', () => {
  it('returns allowed: true for the first request in the window', async () => {
    pipelineMock.exec.mockResolvedValue([1])
    const result = await checkRateLimit('user-1')
    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 })
  })

  it('returns allowed: true at MAX_REQUESTS (second request)', async () => {
    pipelineMock.exec.mockResolvedValue([2])
    const result = await checkRateLimit('user-1')
    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 })
  })
})

describe('checkRateLimit — blocked requests', () => {
  it('returns allowed: false with retryAfterSeconds from TTL when over the limit', async () => {
    pipelineMock.exec.mockResolvedValue([3])
    redisMock.ttl.mockResolvedValue(45)
    const result = await checkRateLimit('user-1')
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 45 })
  })

  it('falls back to WINDOW seconds when TTL is negative (key has no expiry)', async () => {
    pipelineMock.exec.mockResolvedValue([3])
    redisMock.ttl.mockResolvedValue(-1)
    const result = await checkRateLimit('user-1')
    expect(result).toEqual({ allowed: false, retryAfterSeconds: 60 })
  })
})

describe('checkRateLimit — fixed window TTL (Bug 4 regression)', () => {
  it('calls redis.expire once on the first request with the correct window', async () => {
    pipelineMock.exec.mockResolvedValue([1])
    await checkRateLimit('user-1')
    expect(redisMock.expire).toHaveBeenCalledTimes(1)
    expect(redisMock.expire).toHaveBeenCalledWith('rate_limit:user-1', 60)
  })

  it('does not call redis.expire on the second (allowed) request', async () => {
    pipelineMock.exec.mockResolvedValue([2])
    await checkRateLimit('user-1')
    expect(redisMock.expire).not.toHaveBeenCalled()
  })

  it('does not call redis.expire on a blocked request', async () => {
    pipelineMock.exec.mockResolvedValue([3])
    redisMock.ttl.mockResolvedValue(45)
    await checkRateLimit('user-1')
    expect(redisMock.expire).not.toHaveBeenCalled()
  })

  it('a blocked client retrying repeatedly does not reset the TTL', async () => {
    pipelineMock.exec
      .mockResolvedValueOnce([3])
      .mockResolvedValueOnce([4])
      .mockResolvedValueOnce([5])
    redisMock.ttl.mockResolvedValue(40)

    await checkRateLimit('user-1')
    await checkRateLimit('user-1')
    await checkRateLimit('user-1')

    expect(redisMock.expire).not.toHaveBeenCalled()
  })

  it('uses a key namespaced by the caller-supplied key', async () => {
    pipelineMock.exec.mockResolvedValue([1])
    await checkRateLimit('custom-key')
    expect(redisMock.expire).toHaveBeenCalledWith('rate_limit:custom-key', expect.any(Number))
  })
})
