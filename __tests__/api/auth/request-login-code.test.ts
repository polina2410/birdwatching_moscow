import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, sendMailMock, generateLoginCodeMock, hashLoginCodeMock, checkRateLimitMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn() },
    loginCode: { deleteMany: vi.fn(), create: vi.fn() },
  },
  sendMailMock: vi.fn(),
  generateLoginCodeMock: vi.fn().mockReturnValue('ABCD2F'),
  hashLoginCodeMock: vi.fn().mockReturnValue('a'.repeat(64)),
  checkRateLimitMock: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/mail', () => ({ sendMail: sendMailMock }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: checkRateLimitMock }))
vi.mock('@/lib/login-code', () => ({
  generateLoginCode: generateLoginCodeMock,
  hashLoginCode: hashLoginCodeMock,
  normalizeLoginCode: (s: string) => s.replace(/[\s-]/g, '').toUpperCase(),
}))

import { POST } from '@/app/api/auth/request-login-code/route'

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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  it('ADMIN email → 200, no mail, no row', () =>
    expectSafeNoAction({ email: 'admin@test.com' }, { ...USER, role: 'ADMIN' }))

  it('SUPERADMIN email → 200, no mail, no row', () =>
    expectSafeNoAction({ email: 'super@test.com' }, { ...USER, role: 'SUPERADMIN' }))

  it('blocked USER → 200, no mail, no row', () =>
    expectSafeNoAction({ email: USER.email }, { ...USER, blockedAt: new Date() }))

  it('soft-deleted USER → 200, no mail, no row', () =>
    expectSafeNoAction({ email: USER.email }, null)) // findFirst with deletedAt:null returns null
})

describe('POST /api/auth/request-login-code — rate limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 45 })
    const res = await POST(makeReq({ email: USER.email }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('45')
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/request-login-code — validation', () => {
  it('returns 400 for an invalid email', async () => {
    const res = await POST(makeReq({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a missing email', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
  })
})
