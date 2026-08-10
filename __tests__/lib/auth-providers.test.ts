import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, bcryptCompareMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn() },
    loginCode: { findFirst: vi.fn(), update: vi.fn() },
  },
  bcryptCompareMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('bcryptjs', () => ({ default: { compare: bcryptCompareMock, hash: vi.fn() } }))

import { authorizeLoginCode, authorizeCredentials } from '@/lib/auth/authorize'
import { LOGIN_CODE_MAX_ATTEMPTS } from '@/lib/constants'
import { AUTH_ERROR_ACCOUNT_BLOCKED, AUTH_ERROR_PASSWORD_RESET_REQUIRED } from '@/lib/auth/errors'

const USER = {
  id: 'user-1',
  email: 'user@test.com',
  name: 'Иван',
  role: 'USER' as const,
  deletedAt: null,
  blockedAt: null,
  passwordHash: null,
  passwordResetRequired: false,
}
const ADMIN = {
  ...USER,
  id: 'admin-1',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
  passwordHash: '$2b$12$somehash',
}

const ACTIVE_CODE = {
  id: 'code-1',
  email: USER.email,
  codeHash: 'correcthash',
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  usedAt: null,
  attempts: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findFirst.mockResolvedValue(USER)
  prismaMock.loginCode.findFirst.mockResolvedValue(ACTIVE_CODE)
  prismaMock.loginCode.update.mockResolvedValue({ ...ACTIVE_CODE, usedAt: new Date() })
  bcryptCompareMock.mockResolvedValue(true)
})

// ── authorizeLoginCode ──────────────────────────────────────────────────────

describe('authorizeLoginCode — success', () => {
  it('returns { id, email, name, role } for a valid unexpired code', async () => {
    const result = await authorizeLoginCode({ email: USER.email, code: 'ABCD2F' })
    expect(result).toMatchObject({ id: USER.id, email: USER.email, name: USER.name, role: 'USER' })
  })

  it('marks the LoginCode row used (sets usedAt)', async () => {
    await authorizeLoginCode({ email: USER.email, code: 'ABCD2F' })
    expect(prismaMock.loginCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ACTIVE_CODE.id },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    )
  })
})

describe('authorizeLoginCode — null cases', () => {
  it('returns null when no matching LoginCode row is found', async () => {
    prismaMock.loginCode.findFirst.mockResolvedValue(null)
    expect(await authorizeLoginCode({ email: USER.email, code: 'ABCD2F' })).toBeNull()
  })

  it('returns null when the code is already used', async () => {
    prismaMock.loginCode.findFirst.mockResolvedValue({ ...ACTIVE_CODE, usedAt: new Date() })
    expect(await authorizeLoginCode({ email: USER.email, code: 'ABCD2F' })).toBeNull()
  })

  it('returns null when the code is expired', async () => {
    prismaMock.loginCode.findFirst.mockResolvedValue({
      ...ACTIVE_CODE,
      expiresAt: new Date(Date.now() - 1),
    })
    expect(await authorizeLoginCode({ email: USER.email, code: 'ABCD2F' })).toBeNull()
  })

  it('returns null for a code associated with a different email', async () => {
    // The DB query always includes email — simulate no match for other email
    prismaMock.user.findFirst.mockResolvedValue(null)
    expect(await authorizeLoginCode({ email: 'other@test.com', code: 'ABCD2F' })).toBeNull()
  })

  it('returns null when role is ADMIN (OTP path is USER-only)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(ADMIN)
    expect(await authorizeLoginCode({ email: ADMIN.email, code: 'ABCD2F' })).toBeNull()
  })

  it('returns null when attempts have reached LOGIN_CODE_MAX_ATTEMPTS', async () => {
    prismaMock.loginCode.findFirst.mockResolvedValue({
      ...ACTIVE_CODE,
      attempts: LOGIN_CODE_MAX_ATTEMPTS,
    })
    expect(await authorizeLoginCode({ email: USER.email, code: 'ABCD2F' })).toBeNull()
  })
})

describe('authorizeLoginCode — attempt tracking', () => {
  it('increments attempts on the active code when an incorrect code is submitted', async () => {
    // First findFirst: no match (wrong code); second findFirst: the active code to increment
    prismaMock.loginCode.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ACTIVE_CODE)
    await authorizeLoginCode({ email: USER.email, code: 'WRONG1' })
    expect(prismaMock.loginCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ACTIVE_CODE.id },
        data: expect.objectContaining({ attempts: { increment: 1 } }),
      })
    )
  })

  it('does not call update when there is no active code to increment', async () => {
    prismaMock.loginCode.findFirst.mockResolvedValue(null)
    await authorizeLoginCode({ email: USER.email, code: 'WRONG1' })
    expect(prismaMock.loginCode.update).not.toHaveBeenCalled()
  })
})

describe('authorizeLoginCode — AccountBlockedError', () => {
  it('throws with code "account_blocked" for a valid code on a blocked user', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...USER, blockedAt: new Date() })
    await expect(authorizeLoginCode({ email: USER.email, code: 'ABCD2F' })).rejects.toMatchObject({
      code: AUTH_ERROR_ACCOUNT_BLOCKED,
    })
  })
})

// ── authorizeCredentials (password flow) ───────────────────────────────────

describe('authorizeCredentials — passwordHash guard', () => {
  it('returns null without calling bcrypt.compare when user.passwordHash is null', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, passwordHash: null })
    const result = await authorizeCredentials({ email: ADMIN.email, password: 'anything' })
    expect(result).toBeNull()
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })
})

describe('authorizeCredentials — forced rotation', () => {
  it('throws with code "password_reset_required" for correct password when passwordResetRequired=true', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, passwordResetRequired: true })
    bcryptCompareMock.mockResolvedValue(true)
    await expect(
      authorizeCredentials({ email: ADMIN.email, password: 'CorrectPass123!' })
    ).rejects.toMatchObject({ code: AUTH_ERROR_PASSWORD_RESET_REQUIRED })
  })
})

describe('authorizeCredentials — blocked account oracle guard (Bug 3 regression)', () => {
  it('throws AccountBlockedError even when the password is wrong', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, blockedAt: new Date() })
    bcryptCompareMock.mockResolvedValue(false)
    await expect(
      authorizeCredentials({ email: ADMIN.email, password: 'wrongpassword' })
    ).rejects.toMatchObject({ code: AUTH_ERROR_ACCOUNT_BLOCKED })
  })

  it('does not call bcrypt.compare when the account is blocked', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, blockedAt: new Date() })
    await expect(
      authorizeCredentials({ email: ADMIN.email, password: 'anypassword' })
    ).rejects.toThrow()
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })
})

describe('authorizeCredentials — passwordResetRequired oracle guard (Bug 3 regression)', () => {
  it('throws PasswordResetRequiredError even when the password is wrong', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, passwordResetRequired: true })
    bcryptCompareMock.mockResolvedValue(false)
    await expect(
      authorizeCredentials({ email: ADMIN.email, password: 'wrongpassword' })
    ).rejects.toMatchObject({ code: AUTH_ERROR_PASSWORD_RESET_REQUIRED })
  })

  it('does not call bcrypt.compare when passwordResetRequired is true', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, passwordResetRequired: true })
    await expect(
      authorizeCredentials({ email: ADMIN.email, password: 'anypassword' })
    ).rejects.toThrow()
    expect(bcryptCompareMock).not.toHaveBeenCalled()
  })
})
