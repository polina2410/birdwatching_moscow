import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, sendMailMock, bcryptHashMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn(), create: vi.fn() },
  },
  sendMailMock: vi.fn(),
  bcryptHashMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/mail', () => ({ sendMail: sendMailMock }))
vi.mock('bcryptjs', () => ({ default: { hash: bcryptHashMock, compare: vi.fn() } }))

import { POST } from '@/app/api/auth/register/route'
import { HTTP_METHOD, JSON_HEADERS } from '@/lib/constants'

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
  prismaMock.user.create.mockResolvedValue({ id: 'user-1', email: 'new@test.com', name: 'Иван' })
  sendMailMock.mockResolvedValue(undefined)
})

describe('POST /api/auth/register — passwordless USER', () => {
  it('creates a user with passwordHash: null', async () => {
    await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: null }),
      })
    )
  })

  it('does not call bcrypt.hash', async () => {
    await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(bcryptHashMock).not.toHaveBeenCalled()
  })

  it('returns 200 for valid { email, name }', async () => {
    const res = await POST(makeReq({ email: 'new@test.com', name: 'Иван' }))
    expect(res.status).toBe(200)
  })

  it('returns 400 when a password field is sent (password is no longer accepted)', async () => {
    const res = await POST(makeReq({ email: 'new@test.com', name: 'Иван', password: 'secret' }))
    // The schema no longer has a password field; extra fields trigger a strict parse failure OR
    // they're ignored — either way no bcrypt call and the password must not be stored
    expect(bcryptHashMock).not.toHaveBeenCalled()
  })
})
