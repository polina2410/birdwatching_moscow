import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, requestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  requestMock: { update: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({ prisma: { request: requestMock } }))

import { updateRequestStatus } from '@/app/admin/requests/_actions'

const ADMIN_SESSION = { user: { id: 'u1', role: 'ADMIN' as const, name: 'Admin' } }

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(ADMIN_SESSION)
  requestMock.update.mockResolvedValue({})
})

describe('updateRequestStatus — permissions', () => {
  it('throws "Недостаточно прав" when unauthenticated', async () => {
    authMock.mockResolvedValue(null)
    await expect(updateRequestStatus('req-1', 'WAITLIST')).rejects.toThrow('Недостаточно прав')
  })

  it('throws "Недостаточно прав" when called as USER', async () => {
    authMock.mockResolvedValue({ user: { id: 'u2', role: 'USER', name: 'User' } })
    await expect(updateRequestStatus('req-1', 'WAITLIST')).rejects.toThrow('Недостаточно прав')
  })
})

describe('updateRequestStatus — happy path', () => {
  it('calls prisma.request.update with the new status', async () => {
    await updateRequestStatus('req-1', 'WAITLIST')
    expect(requestMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        data: { status: 'WAITLIST' },
      })
    )
  })

  it('can toggle back to NEW status', async () => {
    await updateRequestStatus('req-1', 'NEW')
    expect(requestMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'NEW' } })
    )
  })
})
