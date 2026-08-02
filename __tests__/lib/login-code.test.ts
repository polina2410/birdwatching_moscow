import { describe, it, expect } from 'vitest'
import { generateLoginCode, normalizeLoginCode, hashLoginCode } from '@/lib/login-code'
import { LOGIN_CODE_LENGTH, LOGIN_CODE_ALPHABET } from '@/lib/constants'

describe('generateLoginCode', () => {
  it('returns a string of LOGIN_CODE_LENGTH characters', () => {
    expect(generateLoginCode()).toHaveLength(LOGIN_CODE_LENGTH)
  })

  it('only uses characters from LOGIN_CODE_ALPHABET', () => {
    const allowed = new Set(LOGIN_CODE_ALPHABET)
    for (let i = 0; i < 100; i++) {
      for (const ch of generateLoginCode()) {
        expect(allowed.has(ch), `unexpected char "${ch}"`).toBe(true)
      }
    }
  })

  it('over 1000 calls: never produces 0, O, 1, I or L, and uses ≥25 distinct chars', () => {
    const forbidden = new Set(['0', 'O', '1', 'I', 'L'])
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      for (const ch of generateLoginCode()) {
        expect(forbidden.has(ch), `forbidden char "${ch}"`).toBe(false)
        seen.add(ch)
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(25)
  })
})

describe('normalizeLoginCode', () => {
  it('strips whitespace and hyphens, uppercases: " ab c-d2f " → "ABCD2F"', () => {
    expect(normalizeLoginCode(' ab c-d2f ')).toBe('ABCD2F')
  })

  it('normalizes before hashing so "ab cd2f" and "ABCD2F" produce the same hash', () => {
    expect(hashLoginCode('ab cd2f')).toBe(hashLoginCode('ABCD2F'))
  })
})

describe('hashLoginCode', () => {
  it('returns 64 lowercase hex chars', () => {
    expect(hashLoginCode('ABCD2F')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never equals its raw input', () => {
    const code = generateLoginCode()
    expect(hashLoginCode(code)).not.toBe(code)
  })
})
