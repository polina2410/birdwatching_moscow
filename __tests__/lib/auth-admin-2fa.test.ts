import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AUTH_ERROR_ACCOUNT_BLOCKED, AUTH_ERROR_PASSWORD_RESET_REQUIRED } from '@/lib/auth/errors'

const { prismaMock, bcryptCompareMock, hashChallengeTokenMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn() },
    adminLoginChallenge: { findFirst: vi.fn(), update: vi.fn() },
  },
  bcryptCompareMock: vi.fn(),
  hashChallengeTokenMock: vi.fn().mockImplementation((t: string) => `hash:${t}`),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('bcryptjs', () => ({ default: { compare: bcryptCompareMock, hash: vi.fn() } }))
vi.mock('@/lib/auth/challenge', () => ({ hashChallengeToken: hashChallengeTokenMock }))

import { authorizeAdminTwoFactor } from '@/lib/auth/authorize'

const ADMIN = {
  id: 'admin-1',
  email: 'admin@test.com',
  name: 'Анна',
  role: 'ADMIN' as const,
  deletedAt: null,
  blockedAt: null,
  passwordHash: '$2b$12$somehash',
  passwordResetRequired: false,
}

const ACTIVE_CHALLENGE = {
  id: 'ch-1',
  email: ADMIN.email,
  tokenHash: 'hash:tok',
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  usedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.adminLoginChallenge.findFirst.mockResolvedValue(ACTIVE_CHALLENGE)
  prismaMock.adminLoginChallenge.update.mockResolvedValue({})
  prismaMock.user.findFirst.mockResolvedValue(ADMIN)
  bcryptCompareMock.mockResolvedValue(true)
})

// ── Success ─────────────────────────────────────────────────────────────────

describe('authorizeAdminTwoFactor — success', () => {
  it('returns { id, email, name, role } for valid challenge + correct password', async () => {
    const result = await authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'pass' })
    expect(result).toMatchObject({ id: ADMIN.id, email: ADMIN.email, name: ADMIN.name, role: 'ADMIN' })
  })

  it('marks the AdminLoginChallenge row as used on success', async () => {
    await authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'pass' })
    expect(prismaMock.adminLoginChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ACTIVE_CHALLENGE.id },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    )
  })
})

// ── Null cases ───────────────────────────────────────────────────────────────

describe('authorizeAdminTwoFactor — null cases', () => {
  it('returns null for wrong password; challenge is NOT consumed', async () => {
    bcryptCompareMock.mockResolvedValue(false)
    const result = await authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'wrong' })
    expect(result).toBeNull()
    expect(prismaMock.adminLoginChallenge.update).not.toHaveBeenCalled()
  })

  it('returns null when no matching challenge (expired or used)', async () => {
    prismaMock.adminLoginChallenge.findFirst.mockResolvedValue(null)
    expect(await authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'pass' })).toBeNull()
  })

  it('returns null when user has no passwordHash', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, passwordHash: null })
    expect(await authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'pass' })).toBeNull()
  })

  it('returns null for invalid/missing credentials schema', async () => {
    expect(await authorizeAdminTwoFactor({ email: 'bad' })).toBeNull()
  })
})

// ── AccountBlockedError — oracle guard ──────────────────────────────────────

describe('authorizeAdminTwoFactor — AccountBlockedError', () => {
  beforeEach(() => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, blockedAt: new Date() })
  })

  it('throws AccountBlockedError even when password is correct', async () => {
    await expect(
      authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'pass' })
    ).rejects.toMatchObject({ code: AUTH_ERROR_ACCOUNT_BLOCKED })
  })

  it('does not call bcrypt.compare when account is blocked', async () => {
    await expect(
      authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'pass' })
    ).rejects.toThrow()
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })
})

// ── PasswordResetRequiredError — oracle guard ────────────────────────────────

describe('authorizeAdminTwoFactor — PasswordResetRequiredError', () => {
  beforeEach(() => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, passwordResetRequired: true })
  })

  it('throws PasswordResetRequiredError even when password is correct', async () => {
    await expect(
      authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'pass' })
    ).rejects.toMatchObject({ code: AUTH_ERROR_PASSWORD_RESET_REQUIRED })
  })

  it('does not call bcrypt.compare when passwordResetRequired is true', async () => {
    await expect(
      authorizeAdminTwoFactor({ email: ADMIN.email, challengeToken: 'tok', password: 'pass' })
    ).rejects.toThrow()
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })
})