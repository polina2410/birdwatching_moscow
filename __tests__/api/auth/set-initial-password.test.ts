import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  prismaMock,
  bcryptHashMock,
  generateChallengeTokenMock,
  hashChallengeTokenMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn(), update: vi.fn() },
    adminLoginChallenge: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
  bcryptHashMock: vi.fn().mockResolvedValue('$2b$12$hashed'),
  generateChallengeTokenMock: vi.fn().mockReturnValue('newrawtoken456'),
  hashChallengeTokenMock: vi.fn().mockReturnValue('c'.repeat(64)),
  checkRateLimitMock: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('bcryptjs', () => ({ default: { hash: bcryptHashMock } }))
vi.mock('@/lib/auth/challenge', () => ({
  generateChallengeToken: generateChallengeTokenMock,
  hashChallengeToken: hashChallengeTokenMock,
}))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: checkRateLimitMock }))

import { POST } from '@/app/api/auth/set-initial-password/route'
import { PASSWORD_MIN_LENGTH, HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_TOO_MANY_REQUESTS } from '@/lib/constants'

const VALID_CHALLENGE = {
  id: 'ch1',
  email: 'admin@test.com',
  tokenHash: 'c'.repeat(64),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  usedAt: null,
}

const ADMIN_NO_PASSWORD = {
  id: 'a1',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'ADMIN' as const,
  passwordHash: null,
  blockedAt: null,
  deletedAt: null,
}

const VALID_PASSWORD = 'a'.repeat(PASSWORD_MIN_LENGTH)

function makeReq(body: object) {
  return new Request('http://localhost/api/auth/set-initial-password', {
    method: HTTP_METHOD.POST,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  prismaMock.adminLoginChallenge.findFirst.mockResolvedValue(VALID_CHALLENGE)
  prismaMock.adminLoginChallenge.update.mockResolvedValue({})
  prismaMock.adminLoginChallenge.create.mockResolvedValue({})
  prismaMock.user.findFirst.mockResolvedValue(ADMIN_NO_PASSWORD)
  prismaMock.user.update.mockResolvedValue({})
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe('POST /api/auth/set-initial-password — happy path', () => {
  it('returns 200 with a new challengeToken', async () => {
    const res = await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(res.status).toBe(200)
    expect((await res.json()).challengeToken).toBe('newrawtoken456')
  })

  it('hashes and saves the password on the user row', async () => {
    await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(bcryptHashMock).toHaveBeenCalledWith(VALID_PASSWORD, expect.any(Number))
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ADMIN_NO_PASSWORD.id },
        data: expect.objectContaining({ passwordHash: '$2b$12$hashed' }),
      })
    )
  })

  it('marks the old challenge as used', async () => {
    await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(prismaMock.adminLoginChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_CHALLENGE.id },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    )
  })

  it('creates a new AdminLoginChallenge with a fresh hashed token', async () => {
    await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(prismaMock.adminLoginChallenge.create).toHaveBeenCalledTimes(1)
    const arg = prismaMock.adminLoginChallenge.create.mock.calls[0][0] as {
      data: { tokenHash: string; email: string }
    }
    expect(arg.data.tokenHash).toBe('c'.repeat(64))
    expect(arg.data.tokenHash).not.toBe('newrawtoken456')
    expect(arg.data.email).toBe('admin@test.com')
  })

  it('SUPERADMIN works the same as ADMIN', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN_NO_PASSWORD, role: 'SUPERADMIN' })
    const res = await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(res.status).toBe(200)
  })
})

// ── Invalid challenge ─────────────────────────────────────────────────────────

describe('POST /api/auth/set-initial-password — invalid challenge', () => {
  it('returns 401 when challenge row is not found', async () => {
    prismaMock.adminLoginChallenge.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ email: 'admin@test.com', challengeToken: 'bad', password: VALID_PASSWORD }))
    expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

// ── User not found ────────────────────────────────────────────────────────────

describe('POST /api/auth/set-initial-password — user not found', () => {
  it('returns 400 and does not update user when user row is not found', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

// ── Wrong role ────────────────────────────────────────────────────────────────

describe('POST /api/auth/set-initial-password — USER role not eligible', () => {
  it('returns 400 and does not update user when role is USER', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN_NO_PASSWORD, role: 'USER' })
    const res = await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

// ── Already has password ──────────────────────────────────────────────────────

describe('POST /api/auth/set-initial-password — user already has a password', () => {
  it('returns 400 and does not overwrite the existing hash', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN_NO_PASSWORD, passwordHash: '$2b$12$existing' })
    const res = await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe('POST /api/auth/set-initial-password — validation', () => {
  it('returns 400 for missing email', async () => {
    const res = await POST(makeReq({ challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 for missing challengeToken', async () => {
    const res = await POST(makeReq({ email: 'admin@test.com', password: VALID_PASSWORD }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it(`returns 400 for password shorter than ${PASSWORD_MIN_LENGTH} chars`, async () => {
    const res = await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: 'tooshort' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeReq({ email: 'not-an-email', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })
})

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('POST /api/auth/set-initial-password — rate limiting', () => {
  it('returns 429 with Retry-After when limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
    const res = await POST(makeReq({ email: 'admin@test.com', challengeToken: 'tok', password: VALID_PASSWORD }))
    expect(res.status).toBe(HTTP_STATUS_TOO_MANY_REQUESTS)
    expect(res.headers.get('Retry-After')).toBe('60')
  })
})