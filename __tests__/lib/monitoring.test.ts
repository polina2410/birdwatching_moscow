import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackEmailRequestPerIp, _resetStoreForTesting } from '@/lib/monitoring'

beforeEach(() => {
  _resetStoreForTesting()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('trackEmailRequestPerIp', () => {
  it('does nothing for ip "unknown"', async () => {
    await trackEmailRequestPerIp('unknown', 'user@test.com')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('does not warn when distinct email count is below the threshold', async () => {
    await trackEmailRequestPerIp('1.2.3.4', 'a@test.com')
    await trackEmailRequestPerIp('1.2.3.4', 'b@test.com')
    await trackEmailRequestPerIp('1.2.3.4', 'c@test.com')
    await trackEmailRequestPerIp('1.2.3.4', 'd@test.com')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('warns when distinct email count reaches the threshold (5)', async () => {
    await trackEmailRequestPerIp('1.2.3.4', 'a@test.com')
    await trackEmailRequestPerIp('1.2.3.4', 'b@test.com')
    await trackEmailRequestPerIp('1.2.3.4', 'c@test.com')
    await trackEmailRequestPerIp('1.2.3.4', 'd@test.com')
    await trackEmailRequestPerIp('1.2.3.4', 'e@test.com')
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('anomaly'))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('1.2.3.4'))
  })

  it('warns when distinct email count exceeds the threshold', async () => {
    for (let i = 0; i < 12; i++) {
      await trackEmailRequestPerIp('1.2.3.4', `user${i}@test.com`)
    }
    expect(console.warn).toHaveBeenCalled()
  })

  it('duplicate emails do not count toward the threshold (Set deduplication)', async () => {
    for (let i = 0; i < 10; i++) {
      await trackEmailRequestPerIp('1.2.3.4', 'same@test.com')
    }
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('different IPs have independent counters', async () => {
    for (let i = 0; i < 5; i++) {
      await trackEmailRequestPerIp('1.2.3.4', `user${i}@test.com`)
    }
    vi.clearAllMocks()

    await trackEmailRequestPerIp('5.6.7.8', 'user@test.com')
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('window resets after expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    for (let i = 0; i < 5; i++) {
      await trackEmailRequestPerIp('1.2.3.4', `user${i}@test.com`)
    }
    expect(console.warn).toHaveBeenCalled()
    vi.clearAllMocks()

    vi.setSystemTime(10 * 60 * 1000 + 1)
    await trackEmailRequestPerIp('1.2.3.4', 'fresh@test.com')
    expect(console.warn).not.toHaveBeenCalled()
  })
})
