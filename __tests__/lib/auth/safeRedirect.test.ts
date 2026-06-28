import { describe, it, expect } from 'vitest'
import { safeRedirect } from '@/lib/auth/safeRedirect'

describe('safeRedirect', () => {
  it('returns fallback when target is null', () => {
    expect(safeRedirect(null, '/fallback')).toBe('/fallback')
  })

  it('returns fallback when target is undefined', () => {
    expect(safeRedirect(undefined, '/fallback')).toBe('/fallback')
  })

  it('returns fallback when target is an empty string', () => {
    expect(safeRedirect('', '/fallback')).toBe('/fallback')
  })

  it('returns fallback when target is an absolute URL', () => {
    expect(safeRedirect('https://evil.com', '/fallback')).toBe('/fallback')
  })

  it('returns fallback for protocol-relative URL (//) to block open redirect', () => {
    expect(safeRedirect('//evil.com', '/fallback')).toBe('/fallback')
  })

  it('returns fallback when target contains a backslash', () => {
    expect(safeRedirect('/admin\\@evil.com', '/fallback')).toBe('/fallback')
  })

  it('returns target when it is a safe relative path', () => {
    expect(safeRedirect('/admin', '/')).toBe('/admin')
  })

  it('returns target with query string when safe', () => {
    expect(safeRedirect('/admin/users?page=2', '/')).toBe('/admin/users?page=2')
  })
})
