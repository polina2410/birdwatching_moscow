import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, bcryptHashMock } = vi.hoisted(() => ({
  prismaMock: {
    passwordResetToken: { findUnique: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  bcryptHashMock: vi.fn().mockResolvedValue('$2b$12$newhash'),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('bcryptjs', () => ({ default: { hash: bcryptHashMock, compare: vi.fn() } }))

import { POST } from '@/app/api/auth/reset-password/route'
import { HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_BAD_REQUEST, PASSWORD_MIN_LENGTH } from '@/lib/constants'

const VALID_TOKEN_ROW = {
  id: 'tok-1',
  userId: 'admin-1',
  tokenHash: 'a'.repeat(64),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  usedAt: null,
}
const ADMIN = {
  id: 'admin-1',
  email: 'admin@test.com',
  role: 'ADMIN',
  deletedAt: null,
  passwordResetRequired: true,
}

function makeReq(body: object) {
  return new Request('http://localhost/api/auth/reset-password', {
    method: HTTP_METHOD.POST,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.passwordResetToken.findUnique.mockResolvedValue(VALID_TOKEN_ROW)
  prismaMock.user.findFirst.mockResolvedValue(ADMIN)
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) await op
  })
  prismaMock.user.update.mockResolvedValue({ ...ADMIN, passwordResetRequired: false })
})

describe('POST /api/auth/reset-password — forced rotation flag', () => {
  it('sets passwordResetRequired: false after a successful reset', async () => {
    await POST(makeReq({ token: 'rawtoken123', newPassword: '1234567890123456' }))
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ADMIN.id },
        data: expect.objectContaining({ passwordResetRequired: false }),
      })
    )
  })
})

describe('POST /api/auth/reset-password — token not found', () => {
  it('returns 400 with an "invalid or expired" message', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null)
    const res = await POST(makeReq({ token: 'rawtoken123', newPassword: '1234567890123456' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    const body = await res.json()
    expect(body.error).toMatch(/invalid|expired/i)
  })

  it('does not update the user when token is not found', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null)
    await POST(makeReq({ token: 'rawtoken123', newPassword: '1234567890123456' }))
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/reset-password — token expired', () => {
  it('returns 400 when token.expiresAt is in the past', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      ...VALID_TOKEN_ROW,
      expiresAt: new Date(Date.now() - 1),
    })
    const res = await POST(makeReq({ token: 'rawtoken123', newPassword: '1234567890123456' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/reset-password — token already used', () => {
  it('returns 400 when token.usedAt is not null', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      ...VALID_TOKEN_ROW,
      usedAt: new Date(),
    })
    const res = await POST(makeReq({ token: 'rawtoken123', newPassword: '1234567890123456' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/reset-password — user not found', () => {
  it('returns 400 when the user linked to the token has been soft-deleted', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ token: 'rawtoken123', newPassword: '1234567890123456' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/reset-password — validation', () => {
  it('returns 400 when token field is missing', async () => {
    const res = await POST(makeReq({ newPassword: '1234567890123456' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it(`returns 400 when newPassword is shorter than ${PASSWORD_MIN_LENGTH} chars`, async () => {
    const res = await POST(makeReq({ token: 'rawtoken123', newPassword: 'tooshort' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('returns 400 when body is empty', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
