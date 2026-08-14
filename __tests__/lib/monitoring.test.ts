import { describe, it, expect, vi, beforeEach } from 'vitest'

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    sadd: vi.fn(),
    scard: vi.fn(),
    ttl: vi.fn(),
    expire: vi.fn(),
  },
}))

vi.mock('@/lib/redis', () => ({ redis: redisMock }))

import { trackEmailRequestPerIp } from '@/lib/monitoring'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  redisMock.sadd.mockResolvedValue(1)
  redisMock.scard.mockResolvedValue(1)
  redisMock.ttl.mockResolvedValue(-1)
  redisMock.expire.mockResolvedValue(1)
})

describe('trackEmailRequestPerIp', () => {
  it('does nothing for ip "unknown"', async () => {
    await trackEmailRequestPerIp('unknown', 'user@test.com')
    expect(redisMock.sadd).not.toHaveBeenCalled()
  })

  it('adds the email to the correct Redis set key', async () => {
    await trackEmailRequestPerIp('1.2.3.4', 'user@test.com')
    expect(redisMock.sadd).toHaveBeenCalledWith('anomaly:emails:1.2.3.4', 'user@test.com')
  })

  it('sets expiry when the key has no TTL (ttl === -1)', async () => {
    redisMock.ttl.mockResolvedValue(-1)
    await trackEmailRequestPerIp('1.2.3.4', 'user@test.com')
    expect(redisMock.expire).toHaveBeenCalled()
  })

  it('does not reset expiry when the key already has a TTL', async () => {
    redisMock.ttl.mockResolvedValue(300)
    await trackEmailRequestPerIp('1.2.3.4', 'user@test.com')
    expect(redisMock.expire).not.toHaveBeenCalled()
  })

  it('does not warn when distinct email count is below the threshold', async () => {
    redisMock.scard.mockResolvedValue(4)
    await trackEmailRequestPerIp('1.2.3.4', 'user@test.com')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('warns when distinct email count reaches the threshold (5)', async () => {
    redisMock.scard.mockResolvedValue(5)
    await trackEmailRequestPerIp('1.2.3.4', 'user@test.com')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('anomaly'))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('1.2.3.4'))
  })

  it('warns when distinct email count exceeds the threshold', async () => {
    redisMock.scard.mockResolvedValue(12)
    await trackEmailRequestPerIp('1.2.3.4', 'user@test.com')
    expect(console.warn).toHaveBeenCalled()
  })
})