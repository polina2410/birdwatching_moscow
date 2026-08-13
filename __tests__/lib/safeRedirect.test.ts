import { describe, it, expect } from 'vitest'
import { safeRedirect } from '@/utils/safeRedirect'

describe('safeRedirect', () => {
  // Happy path
  it('returns the target when it is a valid relative path', () => {
    expect(safeRedirect('/dashboard')).toBe('/dashboard')
  })

  it('returns a nested relative path unchanged', () => {
    expect(safeRedirect('/settings/billing')).toBe('/settings/billing')
  })

  it('returns the default fallback when target is null', () => {
    expect(safeRedirect(null)).toBe('/')
  })

  it('returns the default fallback when target is undefined', () => {
    expect(safeRedirect(undefined)).toBe('/')
  })

  it('returns the default fallback when target is an empty string', () => {
    expect(safeRedirect('')).toBe('/')
  })

  it('accepts a custom fallback', () => {
    expect(safeRedirect(null, '/home')).toBe('/home')
  })

  // Open-redirect attack vectors
  it('rejects absolute http URLs', () => {
    expect(safeRedirect('http://evil.com')).toBe('/')
  })

  it('rejects absolute https URLs', () => {
    expect(safeRedirect('https://evil.com/steal')).toBe('/')
  })

  it('rejects protocol-relative URLs starting with //', () => {
    expect(safeRedirect('//evil.com')).toBe('/')
  })

  it('rejects paths containing a backslash (Windows-style bypass)', () => {
    expect(safeRedirect('/\\evil.com')).toBe('/')
  })

  it('rejects URLs with a backslash anywhere in the path', () => {
    expect(safeRedirect('/path\\to\\page')).toBe('/')
  })

  // Boundary: valid paths that should not be rejected
  it('returns "/" unchanged (root is a valid relative path)', () => {
    expect(safeRedirect('/')).toBe('/')
  })

  it('returns a path with a query string unchanged', () => {
    expect(safeRedirect('/dashboard?tab=settings')).toBe('/dashboard?tab=settings')
  })

  it('returns a path with a URL fragment unchanged', () => {
    expect(safeRedirect('/page#section')).toBe('/page#section')
  })

  // URL-encoded bypass attempt: starts with '%', not '/', so the leading-slash check rejects it
  it('rejects a URL-encoded bypass attempt (%2F%2Fevil.com)', () => {
    expect(safeRedirect('%2F%2Fevil.com')).toBe('/')
  })
})
