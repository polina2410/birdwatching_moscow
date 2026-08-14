import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateLoginCsrfToken, verifyLoginCsrfToken } from '@/lib/auth/csrf'

const SECRET = 'test-secret-abc123'

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
})

afterEach(() => {
  delete process.env.AUTH_SECRET
  vi.useRealTimers()
})

// ── generateLoginCsrfToken ───────────────────────────────────────────────────

describe('generateLoginCsrfToken', () => {
  it('returns a token in "window.signature" format', () => {
    const token = generateLoginCsrfToken('user@test.com')
    expect(token).toMatch(/^\d+\.[A-Za-z0-9_-]+$/)
  })

  it('throws when AUTH_SECRET is not set', () => {
    delete process.env.AUTH_SECRET
    expect(() => generateLoginCsrfToken('user@test.com')).toThrow()
  })

  it('produces different tokens for different emails', () => {
    const t1 = generateLoginCsrfToken('a@test.com')
    const t2 = generateLoginCsrfToken('b@test.com')
    expect(t1).not.toBe(t2)
  })

  it('produces the same token for the same email within the same 5-min window', () => {
    const t1 = generateLoginCsrfToken('user@test.com')
    vi.setSystemTime(new Date('2026-01-01T00:04:59.000Z'))
    const t2 = generateLoginCsrfToken('user@test.com')
    expect(t1).toBe(t2)
  })

  it('produces a different token in a new window', () => {
    const t1 = generateLoginCsrfToken('user@test.com')
    vi.setSystemTime(new Date('2026-01-01T00:05:00.000Z'))
    const t2 = generateLoginCsrfToken('user@test.com')
    expect(t1).not.toBe(t2)
  })
})

// ── verifyLoginCsrfToken ─────────────────────────────────────────────────────

describe('verifyLoginCsrfToken', () => {
  it('verifies a just-generated token', () => {
    const email = 'user@test.com'
    expect(verifyLoginCsrfToken(generateLoginCsrfToken(email), email)).toBe(true)
  })

  it('rejects a token for a different email', () => {
    const token = generateLoginCsrfToken('a@test.com')
    expect(verifyLoginCsrfToken(token, 'b@test.com')).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const [windowPart] = generateLoginCsrfToken('user@test.com').split('.')
    expect(verifyLoginCsrfToken(`${windowPart}.tampered`, 'user@test.com')).toBe(false)
  })

  it('rejects a token with no dot separator', () => {
    expect(verifyLoginCsrfToken('nodot', 'user@test.com')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(verifyLoginCsrfToken('', 'user@test.com')).toBe(false)
  })

  it('rejects a token from 2 full windows ago', () => {
    const token = generateLoginCsrfToken('user@test.com')
    vi.setSystemTime(new Date('2026-01-01T00:10:00.001Z')) // 2 windows ahead
    expect(verifyLoginCsrfToken(token, 'user@test.com')).toBe(false)
  })

  it('accepts a token generated in the previous window', () => {
    const token = generateLoginCsrfToken('user@test.com')
    vi.setSystemTime(new Date('2026-01-01T00:05:00.001Z')) // 1 window ahead
    expect(verifyLoginCsrfToken(token, 'user@test.com')).toBe(true)
  })

  it('returns false when AUTH_SECRET is not set', () => {
    const token = generateLoginCsrfToken('user@test.com')
    delete process.env.AUTH_SECRET
    expect(verifyLoginCsrfToken(token, 'user@test.com')).toBe(false)
  })
})