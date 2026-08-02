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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
