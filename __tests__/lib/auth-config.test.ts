import { describe, it, expect, vi } from 'vitest'

// Prevent NextAuth and prisma from making real connections
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('next-auth', () => ({
  default: (config: unknown) => ({ handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn(), _config: config }),
}))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn(), hash: vi.fn() } }))

import { SESSION_MAX_AGE_SECONDS, SESSION_UPDATE_AGE_SECONDS } from '@/lib/constants'
import { authOptions } from '@/lib/auth'

describe('Session constants', () => {
  it('SESSION_MAX_AGE_SECONDS is 1209600 (14 days)', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(1209600)
  })

  it('SESSION_UPDATE_AGE_SECONDS is 86400 (1 day)', () => {
    expect(SESSION_UPDATE_AGE_SECONDS).toBe(86400)
  })
})

describe('authOptions session block', () => {
  it('session.maxAge is SESSION_MAX_AGE_SECONDS (1209600)', () => {
    expect(authOptions.session?.maxAge).toBe(1209600)
  })

  it('session.updateAge is SESSION_UPDATE_AGE_SECONDS (86400)', () => {
    expect(authOptions.session?.updateAge).toBe(86400)
  })

  it('session.strategy is "jwt"', () => {
    expect(authOptions.session?.strategy).toBe('jwt')
  })
})
