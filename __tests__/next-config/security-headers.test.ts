import { describe, it, expect } from 'vitest'
import nextConfig, { SECURITY_HEADERS } from '@/next.config'

describe('SECURITY_HEADERS', () => {
  it('contains X-Frame-Options: SAMEORIGIN', () => {
    expect(SECURITY_HEADERS).toContainEqual({ key: 'X-Frame-Options', value: 'SAMEORIGIN' })
  })

  it('contains X-Content-Type-Options: nosniff', () => {
    expect(SECURITY_HEADERS).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' })
  })

  it('contains Referrer-Policy: strict-origin-when-cross-origin', () => {
    expect(SECURITY_HEADERS).toContainEqual({
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    })
  })

  it('contains Permissions-Policy disabling camera, microphone, geolocation', () => {
    expect(SECURITY_HEADERS).toContainEqual({
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    })
  })
})

describe('nextConfig.headers()', () => {
  it('returns exactly one source entry', async () => {
    const entries = await nextConfig.headers!()
    expect(entries).toHaveLength(1)
  })

  it('source entry matches /:path*', async () => {
    const entries = await nextConfig.headers!()
    expect(entries[0].source).toBe('/:path*')
  })

  it('source entry headers match SECURITY_HEADERS', async () => {
    const entries = await nextConfig.headers!()
    expect(entries[0].headers).toEqual(SECURITY_HEADERS)
  })
})

describe('nextConfig', () => {
  it('retains reactCompiler: true', () => {
    expect(nextConfig.reactCompiler).toBe(true)
  })
})
