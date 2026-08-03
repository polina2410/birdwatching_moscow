import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  confirmResetSchema,
  requestLoginCodeSchema,
  verifyLoginCodeSchema,
} from '@/lib/validation/auth'

describe('registerSchema (passwordless)', () => {
  it('accepts { email, name } with no password', () => {
    expect(registerSchema.safeParse({ email: 'test@example.com', name: 'Иван' }).success).toBe(true)
  })

  it('has no password key in its shape', () => {
    expect('password' in registerSchema.shape).toBe(false)
  })
})

describe('requestLoginCodeSchema', () => {
  it('accepts a valid email', () => {
    expect(requestLoginCodeSchema.safeParse({ email: 'user@example.com' }).success).toBe(true)
  })

  it('rejects a non-email string', () => {
    expect(requestLoginCodeSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects a missing email', () => {
    expect(requestLoginCodeSchema.safeParse({}).success).toBe(false)
  })
})

describe('verifyLoginCodeSchema', () => {
  it('accepts valid email + code', () => {
    expect(verifyLoginCodeSchema.safeParse({ email: 'user@example.com', code: 'ABCD2F' }).success).toBe(true)
  })

  it('rejects missing code', () => {
    expect(verifyLoginCodeSchema.safeParse({ email: 'user@example.com' }).success).toBe(false)
  })

  it('rejects missing email', () => {
    expect(verifyLoginCodeSchema.safeParse({ code: 'ABCD2F' }).success).toBe(false)
  })
})

describe('confirmResetSchema (PASSWORD_MIN_LENGTH = 16)', () => {
  it('rejects a 15-character password', () => {
    expect(
      confirmResetSchema.safeParse({ token: 'tok', newPassword: '123456789012345' }).success
    ).toBe(false)
  })

  it('accepts a 16-character password', () => {
    expect(
      confirmResetSchema.safeParse({ token: 'tok', newPassword: '1234567890123456' }).success
    ).toBe(true)
  })
})
