import { describe, it, expect } from 'vitest'
import nextConfig from '@/next.config'

describe('nextConfig.images.remotePatterns', () => {
  it('defines remotePatterns', () => {
    expect(nextConfig.images?.remotePatterns).toBeDefined()
  })

  it('includes exactly one pattern', () => {
    expect(nextConfig.images?.remotePatterns).toHaveLength(1)
  })

  it('pattern hostname is storage.yandexcloud.net', () => {
    const pattern = nextConfig.images?.remotePatterns?.[0]
    expect(pattern?.hostname).toBe('storage.yandexcloud.net')
  })

  it('pattern does not use a wildcard hostname', () => {
    const pattern = nextConfig.images?.remotePatterns?.[0]
    expect(pattern?.hostname).not.toContain('*')
  })

  it('pattern uses https protocol', () => {
    const pattern = nextConfig.images?.remotePatterns?.[0]
    expect(pattern?.protocol).toBe('https')
  })
})
