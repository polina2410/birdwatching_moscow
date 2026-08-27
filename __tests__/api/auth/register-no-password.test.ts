import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, sendMailMock, bcryptHashMock, checkRateLimitMock, generateLoginCsrfTokenMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn() },
    loginCode: { deleteMany: vi.fn(), create: vi.fn() },
  },
  sendMailMock: vi.fn(),
  bcryptHashMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  generateLoginCsrfTokenMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/mail', () => ({ sendMail: sendMailMock }))
vi.mock('bcryptjs', () => ({ default: { hash: bcryptHashMock, compare: vi.fn() } }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: checkRateLimitMock }))
vi.mock('@/lib/auth/csrf', () => ({ generateLoginCsrfToken: generateLoginCsrfTokenMock }))
vi.mock('@/lib/login-code', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/login-code')>()
  return { ...real, generateLoginCode: () => '123456' }
})

import { POST } from '@/app/api/auth/register/route'
import { HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_CONFLICT } from '@/lib/constants'

function makeReq(body: object) {
  return new Request('http://localhost/api/auth/register', {
    method: HTTP_METHOD.POST,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findFirst.mockResolvedValue(null)
  prismaMock.loginCode.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.loginCode.create.mockResolvedValue({ id: 'code-1' })
  sendMailMock.mockResolvedValue(undefined)
  checkRateLimitMock.mockResolvedValue({ allowed: true })
  generateLoginCsrfTokenMock.mockReturnValue('csrf-token-123')
})

describe('POST /api/auth/register — sends OTP, does not create user', () => {
  it('returns 200 with csrfToken for valid { email, name }', async () => {
    const res = await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.csrfToken).toBe('csrf-token-123')
  })

  it('creates a LoginCode row, not a user', async () => {
    await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(prismaMock.loginCode.create).toHaveBeenCalledOnce()
    expect(prismaMock.user).not.toHaveProperty('create')
  })

  it('sends a login-code email, not a welcome email', async () => {
    await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'login-code', to: 'new@test.com' })
    )
  })

  it('deletes previous unused codes before creating a new one', async () => {
    await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(prismaMock.loginCode.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ email: 'new@test.com' }) })
    )
  })

  it('does not call bcrypt.hash', async () => {
    await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(bcryptHashMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/register — validation', () => {
  it('returns 400 for a missing email', async () => {
    const res = await POST(makeReq({ name: 'Иван' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.loginCode.create).not.toHaveBeenCalled()
  })

  it('returns 400 for a missing name', async () => {
    const res = await POST(makeReq({ email: 'new@test.com' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.loginCode.create).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid email format', async () => {
    const res = await POST(makeReq({ email: 'not-an-email', name: 'Иван' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.loginCode.create).not.toHaveBeenCalled()
  })

  it('does not call bcrypt when a password field is sent (ignored by schema)', async () => {
    await POST(makeReq({ email: 'new@test.com', name: 'Иван', password: 'secret' }))
    expect(bcryptHashMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/register — duplicate email', () => {
  it('returns 409 when the email is already registered', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'existing-1', email: 'new@test.com' })
    const res = await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(res.status).toBe(HTTP_STATUS_CONFLICT)
    expect(prismaMock.loginCode.create).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/register — rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
    const res = await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(res.status).toBe(429)
    expect(prismaMock.loginCode.create).not.toHaveBeenCalled()
  })
})
