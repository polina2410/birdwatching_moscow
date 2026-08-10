import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  prismaMock,
  generateChallengeTokenMock,
  hashChallengeTokenMock,
  hashLoginCodeMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn() },
    loginCode: { findFirst: vi.fn(), update: vi.fn() },
    adminLoginChallenge: { create: vi.fn() },
  },
  generateChallengeTokenMock: vi.fn().mockReturnValue('rawtoken123'),
  hashChallengeTokenMock: vi.fn().mockReturnValue('b'.repeat(64)),
  hashLoginCodeMock: vi.fn().mockReturnValue('a'.repeat(64)),
  checkRateLimitMock: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth/challenge', () => ({
  generateChallengeToken: generateChallengeTokenMock,
  hashChallengeToken: hashChallengeTokenMock,
}))
vi.mock('@/lib/login-code', () => ({ hashLoginCode: hashLoginCodeMock }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: checkRateLimitMock }))

import { POST } from '@/app/api/auth/verify-login-code/route'
import { LOGIN_CODE_MAX_ATTEMPTS, HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_TOO_MANY_REQUESTS } from '@/lib/constants'

const USER = {
  id: 'u1',
  email: 'user@test.com',
  name: 'Иван',
  role: 'USER',
  deletedAt: null,
  blockedAt: null,
}
const ADMIN = {
  ...USER,
  id: 'a1',
  email: 'admin@test.com',
  role: 'ADMIN',
  passwordHash: '$2b$12$somehash',
}
const ACTIVE_CODE = {
  id: 'code-1',
  email: ADMIN.email,
  codeHash: 'a'.repeat(64),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  usedAt: null,
  attempts: 0,
}

function makeReq(body: object) {
  return new Request('http://localhost/api/auth/verify-login-code', {
    method: HTTP_METHOD.POST,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  prismaMock.loginCode.update.mockResolvedValue({})
  prismaMock.adminLoginChallenge.create.mockResolvedValue({})
})

// ── USER / unknown / blocked → always { next: 'session' } ──────────────────

describe('POST /api/auth/verify-login-code — session passthrough', () => {
  it('unknown email → 200 { next: "session" }', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ email: 'nobody@test.com', code: 'ABCD2F' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ next: 'session' })
  })

  it('USER email → 200 { next: "session" } without touching LoginCode table', async () => {
    prismaMock.user.findFirst.mockResolvedValue(USER)
    const res = await POST(makeReq({ email: USER.email, code: 'ABCD2F' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ next: 'session' })
    expect(prismaMock.loginCode.findFirst).not.toHaveBeenCalled()
  })

  it('blocked ADMIN → 200 { next: "session" } (no role disclosure)', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, blockedAt: new Date() })
    const res = await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ next: 'session' })
    expect(prismaMock.loginCode.findFirst).not.toHaveBeenCalled()
  })
})

// ── ADMIN with valid code → { next: 'password', challengeToken } ───────────

describe('POST /api/auth/verify-login-code — ADMIN valid code', () => {
  beforeEach(() => {
    prismaMock.user.findFirst.mockResolvedValue(ADMIN)
    prismaMock.loginCode.findFirst.mockResolvedValue(ACTIVE_CODE)
  })

  it('returns 200 { next: "password", challengeToken }', async () => {
    const res = await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.next).toBe('password')
    expect(body.challengeToken).toBe('rawtoken123')
  })

  it('marks the LoginCode row as used', async () => {
    await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(prismaMock.loginCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ACTIVE_CODE.id },
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      })
    )
  })

  it('creates one AdminLoginChallenge row with the hashed token, not the raw token', async () => {
    await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(prismaMock.adminLoginChallenge.create).toHaveBeenCalledTimes(1)
    const arg = prismaMock.adminLoginChallenge.create.mock.calls[0][0] as {
      data: { tokenHash: string; email: string }
    }
    expect(arg.data.tokenHash).toBe('b'.repeat(64))
    expect(arg.data.tokenHash).not.toBe('rawtoken123')
    expect(arg.data.email).toBe(ADMIN.email)
  })

  it('SUPERADMIN gets the same treatment as ADMIN', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, role: 'SUPERADMIN' })
    const res = await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(res.status).toBe(200)
    expect((await res.json()).next).toBe('password')
  })
})

// ── ADMIN with no password → { next: 'set-password', challengeToken } ────────

describe('POST /api/auth/verify-login-code — ADMIN no passwordHash (first login)', () => {
  beforeEach(() => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, passwordHash: null })
    prismaMock.loginCode.findFirst.mockResolvedValue(ACTIVE_CODE)
  })

  it('returns 200 { next: "set-password", challengeToken }', async () => {
    const res = await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.next).toBe('set-password')
    expect(body.challengeToken).toBe('rawtoken123')
  })

  it('SUPERADMIN with no password also gets { next: "set-password" }', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, role: 'SUPERADMIN', passwordHash: null })
    const res = await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect((await res.json()).next).toBe('set-password')
  })

  it('marks code used and creates a challenge row (same as password path)', async () => {
    await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(prismaMock.loginCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usedAt: expect.any(Date) }) })
    )
    expect(prismaMock.adminLoginChallenge.create).toHaveBeenCalledTimes(1)
  })
})

// ── ADMIN with invalid code → 401 ──────────────────────────────────────────

describe('POST /api/auth/verify-login-code — ADMIN invalid code', () => {
  beforeEach(() => {
    prismaMock.user.findFirst.mockResolvedValue(ADMIN)
    // First findFirst: no match (wrong/expired/over-limit). Second: active code to increment.
    prismaMock.loginCode.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(ACTIVE_CODE)
  })

  it('returns 401', async () => {
    const res = await POST(makeReq({ email: ADMIN.email, code: 'WRONG1' }))
    expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED)
  })

  it('increments attempts on the active code', async () => {
    await POST(makeReq({ email: ADMIN.email, code: 'WRONG1' }))
    expect(prismaMock.loginCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempts: { increment: 1 } }),
      })
    )
  })

  it('does not create a challenge row', async () => {
    await POST(makeReq({ email: ADMIN.email, code: 'WRONG1' }))
    expect(prismaMock.adminLoginChallenge.create).not.toHaveBeenCalled()
  })

  it('returns 401 and does not increment when there is no active code', async () => {
    prismaMock.loginCode.findFirst.mockReset()
    prismaMock.loginCode.findFirst
      .mockResolvedValueOnce(null)  // no match
      .mockResolvedValueOnce(null)  // no active code to increment
    const res = await POST(makeReq({ email: ADMIN.email, code: 'WRONG1' }))
    expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED)
    expect(prismaMock.loginCode.update).not.toHaveBeenCalled()
  })

  it('returns 401 when code is at attempt limit', async () => {
    prismaMock.loginCode.findFirst.mockReset()
    prismaMock.loginCode.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...ACTIVE_CODE, attempts: LOGIN_CODE_MAX_ATTEMPTS })
    const res = await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED)
  })
})

// ── Rate limiting ───────────────────────────────────────────────────────────

describe('POST /api/auth/verify-login-code — rate limiting', () => {
  it('returns 429 with Retry-After when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 })
    prismaMock.user.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ email: ADMIN.email, code: 'ABCD2F' }))
    expect(res.status).toBe(HTTP_STATUS_TOO_MANY_REQUESTS)
    expect(res.headers.get('Retry-After')).toBe('30')
  })
})

// ── Validation ──────────────────────────────────────────────────────────────

describe('POST /api/auth/verify-login-code — validation', () => {
  beforeEach(() => prismaMock.user.findFirst.mockResolvedValue(null))

  it('returns 400 for missing email', async () => {
    expect((await POST(makeReq({ code: 'ABCD2F' }))).status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 for missing code', async () => {
    expect((await POST(makeReq({ email: ADMIN.email }))).status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 for invalid email format', async () => {
    expect((await POST(makeReq({ email: 'not-an-email', code: 'ABCD2F' }))).status).toBe(HTTP_STATUS_BAD_REQUEST)
  })
})