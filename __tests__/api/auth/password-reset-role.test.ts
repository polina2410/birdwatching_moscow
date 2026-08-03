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

const USER = { id: 'user-1', email: 'user@test.com', role: 'USER', deletedAt: null }
const ADMIN = { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN', deletedAt: null }

const SAFE_RESPONSE_MESSAGE = 'If this email is registered, a reset link has been sent.'

function makeReq(email: string) {
  return new Request('http://localhost/api/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
})
