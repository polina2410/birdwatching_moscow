import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, sendMailMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn() },
    passwordResetToken: { deleteMany: vi.fn(), create: vi.fn() },
  },
  sendMailMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/mail', () => ({ sendMail: sendMailMock }))

import { POST } from '@/app/api/auth/request-password-reset/route'
import { HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_BAD_REQUEST } from '@/lib/constants'

const USER = { id: 'user-1', email: 'user@test.com', role: 'USER', deletedAt: null }
const ADMIN = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN', deletedAt: null }

const SAFE_RESPONSE_MESSAGE = 'If this email is registered, a reset link has been sent.'

function makeReq(email: string) {
  return new Request('http://localhost/api/auth/request-password-reset', {
    method: HTTP_METHOD.POST,
    headers: JSON_HEADERS,
    body: JSON.stringify({ email }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.passwordResetToken.create.mockResolvedValue({ id: 'token-1' })
  sendMailMock.mockResolvedValue(undefined)
})

describe('POST /api/auth/request-password-reset — role guard', () => {
  it('USER email: returns SAFE_RESPONSE and creates zero PasswordResetToken rows', async () => {
    prismaMock.user.findFirst.mockResolvedValue(USER)
    const res = await POST(makeReq(USER.email))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe(SAFE_RESPONSE_MESSAGE)
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('ADMIN email: returns SAFE_RESPONSE and creates one PasswordResetToken row', async () => {
    prismaMock.user.findFirst.mockResolvedValue(ADMIN)
    const res = await POST(makeReq(ADMIN.email))
    expect(res.status).toBe(200)
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledTimes(1)
  })

  it('SUPERADMIN email: creates one PasswordResetToken row and sends mail', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...ADMIN, id: 'super-1', role: 'SUPERADMIN' })
    const res = await POST(makeReq(ADMIN.email))
    expect(res.status).toBe(200)
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledTimes(1)
  })

  it('unknown email: returns SAFE_RESPONSE, creates no token, sends no mail', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq('nobody@test.com'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe(SAFE_RESPONSE_MESSAGE)
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('soft-deleted ADMIN: returns SAFE_RESPONSE, creates no token, sends no mail', async () => {
    // findFirst with deletedAt:null returns null for soft-deleted users
    prismaMock.user.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq(ADMIN.email))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe(SAFE_RESPONSE_MESSAGE)
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/request-password-reset — validation', () => {
  it('returns 400 for an invalid email format', async () => {
    const res = await POST(makeReq('not-an-email'))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled()
  })
})
