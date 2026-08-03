import { describe, it, expect, vi, afterEach } from 'vitest'
import nextConfig from '@/next.config'

afterEach(() => vi.unstubAllEnvs())

describe('next.config rewrites', () => {
  it('returns no rewrites in development (Django proxy removed)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const rewrites = await nextConfig.rewrites?.()
    const list = Array.isArray(rewrites) ? rewrites : []
    expect(list).toEqual([])
  })

  it('returns no rewrites in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rewrites = await nextConfig.rewrites?.()
    const list = Array.isArray(rewrites) ? rewrites : []
    expect(list).toEqual([])
  })
})
