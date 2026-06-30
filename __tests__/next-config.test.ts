import { describe, it, expect, vi, afterEach } from 'vitest'
import nextConfig from '@/next.config'

afterEach(() => vi.unstubAllEnvs())

describe('next.config rewrites', () => {
  it('returns the Django proxy rewrite in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const rewrites = await nextConfig.rewrites!()
    expect(rewrites).toEqual([
      { source: '/admin/:path*', destination: 'http://localhost:8000/admin/:path*' },
    ])
  })

  it('returns empty array in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rewrites = await nextConfig.rewrites!()
    expect(rewrites).toEqual([])
  })
})
