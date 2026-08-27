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

  it('over 1000 calls: uses all 10 digits and no non-digit chars', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      for (const ch of generateLoginCode()) {
        expect(/\d/.test(ch), `non-digit char "${ch}"`).toBe(true)
        seen.add(ch)
      }
    }
    expect(seen.size).toBe(10)
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
