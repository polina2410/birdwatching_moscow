import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  prismaMock,
  sendMailMock,
  generateLoginCodeMock,
  hashLoginCodeMock,
  checkRateLimitMock,
  generateLoginCsrfTokenMock,
  trackEmailRequestPerIpMock,
} = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn() },
    loginCode: { deleteMany: vi.fn(), create: vi.fn() },
  },
  sendMailMock: vi.fn(),
  generateLoginCodeMock: vi.fn().mockReturnValue('ABCD2F'),
  hashLoginCodeMock: vi.fn().mockReturnValue('a'.repeat(64)),
  checkRateLimitMock: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  generateLoginCsrfTokenMock: vi.fn().mockReturnValue('mock-csrf-token'),
  trackEmailRequestPerIpMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/mail', () => ({ sendMail: sendMailMock }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: checkRateLimitMock }))
vi.mock('@/lib/auth/csrf', () => ({ generateLoginCsrfToken: generateLoginCsrfTokenMock }))
vi.mock('@/lib/monitoring', () => ({ trackEmailRequestPerIp: trackEmailRequestPerIpMock }))
vi.mock('@/lib/login-code', () => ({
  generateLoginCode: generateLoginCodeMock,
  hashLoginCode: hashLoginCodeMock,
  normalizeLoginCode: (s: string) => s.replace(/[\s-]/g, '').toUpperCase(),
}))

import { POST } from '@/app/api/auth/request-login-code/route'
import { HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_TOO_MANY_REQUESTS } from '@/lib/constants'

const USER = {
  id: 'user-1',
  email: 'user@test.com',
  name: 'Иван',
  role: 'USER',
  deletedAt: null,
  blockedAt: null,
}

function makeReq(body: object) {
  return new Request('http://localhost/api/auth/request-login-code', {
    method: HTTP_METHOD.POST,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findFirst.mockResolvedValue(USER)
  prismaMock.loginCode.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.loginCode.create.mockResolvedValue({ id: 'code-1' })
  sendMailMock.mockResolvedValue(undefined)
  checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  generateLoginCsrfTokenMock.mockReturnValue('mock-csrf-token')
  trackEmailRequestPerIpMock.mockResolvedValue(undefined)
})

describe('POST /api/auth/request-login-code — registered USER', () => {
  it('returns 200', async () => {
    const res = await POST(makeReq({ email: USER.email }))
    expect(res.status).toBe(200)
  })

  it('creates exactly one LoginCode row', async () => {
    await POST(makeReq({ email: USER.email }))
    expect(prismaMock.loginCode.create).toHaveBeenCalledTimes(1)
  })

  it('calls sendMail with kind "login-code"', async () => {
    await POST(makeReq({ email: USER.email }))
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'login-code', to: USER.email })
    )
  })

  it('stores the hash, not the raw code', async () => {
    await POST(makeReq({ email: USER.email }))
    const createArg = prismaMock.loginCode.create.mock.calls[0][0] as { data: { codeHash: string } }
    const rawCode = generateLoginCodeMock.mock.results[0].value as string
    expect(createArg.data.codeHash).not.toBe(rawCode)
    expect(hashLoginCodeMock).toHaveBeenCalledWith(rawCode)
  })

  it('deletes previous codes before creating a new one', async () => {
    await POST(makeReq({ email: USER.email }))
    expect(prismaMock.loginCode.deleteMany).toHaveBeenCalled()
    // deleteMany must be called before create
    const deleteManyOrder = prismaMock.loginCode.deleteMany.mock.invocationCallOrder[0]
    const createOrder = prismaMock.loginCode.create.mock.invocationCallOrder[0]
    expect(deleteManyOrder).toBeLessThan(createOrder)
  })
})

describe('POST /api/auth/request-login-code — safe response (no action taken)', () => {
  const expectSafeNoAction = async (body: object, userMock: unknown = null) => {
    prismaMock.user.findFirst.mockResolvedValue(userMock)
    const res = await POST(makeReq(body))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(prismaMock.loginCode.create).not.toHaveBeenCalled()
  }

  it('unknown email → 200, no mail, no row', () =>
    expectSafeNoAction({ email: 'nobody@test.com' }, null))

  it('blocked USER → 200, no mail, no row', () =>
    expectSafeNoAction({ email: USER.email }, { ...USER, blockedAt: new Date() }))

  it('blocked ADMIN → 200, no mail, no row', () =>
    expectSafeNoAction({ email: 'admin@test.com' }, { ...USER, role: 'ADMIN', blockedAt: new Date() }))

  it('soft-deleted USER → 200, no mail, no row', () =>
    expectSafeNoAction({ email: USER.email }, null)) // findFirst with deletedAt:null returns null
})

describe('POST /api/auth/request-login-code — ADMIN/SUPERADMIN receive codes', () => {
  it('ADMIN email → 200, sends mail, creates row', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...USER, role: 'ADMIN', email: 'admin@test.com' })
    const res = await POST(makeReq({ email: 'admin@test.com' }))
    expect(res.status).toBe(200)
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(prismaMock.loginCode.create).toHaveBeenCalledTimes(1)
  })

  it('SUPERADMIN email → 200, sends mail, creates row', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...USER, role: 'SUPERADMIN', email: 'super@test.com' })
    const res = await POST(makeReq({ email: 'super@test.com' }))
    expect(res.status).toBe(200)
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(prismaMock.loginCode.create).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/auth/request-login-code — rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 45 })
    const res = await POST(makeReq({ email: USER.email }))
    expect(res.status).toBe(HTTP_STATUS_TOO_MANY_REQUESTS)
    expect(res.headers.get('Retry-After')).toBe('45')
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/request-login-code — validation', () => {
  it('returns 400 for an invalid email', async () => {
    const res = await POST(makeReq({ email: 'not-an-email' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 for a missing email', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })
})

// ── CSRF token in response ───────────────────────────────────────────────────

describe('POST /api/auth/request-login-code — CSRF token', () => {
  it('includes csrfToken in the 200 response for a registered user', async () => {
    const res = await POST(makeReq({ email: USER.email }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.csrfToken).toBe('mock-csrf-token')
  })

  it('includes csrfToken even for an unknown email (anti-enumeration)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ email: 'nobody@test.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.csrfToken).toBe('mock-csrf-token')
  })

  it('passes the email to generateLoginCsrfToken', async () => {
    await POST(makeReq({ email: USER.email }))
    expect(generateLoginCsrfTokenMock).toHaveBeenCalledWith(USER.email)
  })
})

// ── Anomaly monitoring ───────────────────────────────────────────────────────

describe('POST /api/auth/request-login-code — anomaly monitoring', () => {
  it('calls trackEmailRequestPerIp with the client IP and email', async () => {
    const res = await POST(
      new Request('http://localhost/api/auth/request-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' },
        body: JSON.stringify({ email: USER.email }),
      })
    )
    expect(res.status).toBe(200)
    expect(trackEmailRequestPerIpMock).toHaveBeenCalledWith('10.0.0.1', USER.email)
  })

  it('does not block the response when anomaly tracking fails', async () => {
    trackEmailRequestPerIpMock.mockRejectedValue(new Error('Redis down'))
    const res = await POST(makeReq({ email: USER.email }))
    expect(res.status).toBe(200)
  })
})
