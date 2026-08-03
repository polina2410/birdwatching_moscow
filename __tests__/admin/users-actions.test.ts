import { describe, it, expect, vi, beforeEach } from 'vitest'

const txMock = {
  user: { update: vi.fn(), count: vi.fn() },
  roleChangeLog: { create: vi.fn() },
}

const { authMock, prismaMock } = vi.hoisted(() => {
  const txMock = {
    user: { update: vi.fn(), count: vi.fn() },
    roleChangeLog: { create: vi.fn() },
  }
  return {
    authMock: vi.fn(),
    prismaMock: {
      $transaction: vi.fn().mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
      user: { findFirst: vi.fn(), update: vi.fn(), count: vi.fn() },
      _tx: txMock,
    },
  }
})

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { changeUserRole, blockUser } from '@/app/admin/users/_actions'

const SUPERADMIN_SESSION = { user: { id: 'su-1', role: 'SUPERADMIN' as const, name: 'SA' } }
const ADMIN_SESSION = { user: { id: 'a-1', role: 'ADMIN' as const, name: 'A' } }

// Access the tx mock via the hoisted prismaMock
const tx = prismaMock._tx

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(SUPERADMIN_SESSION)
  prismaMock.user.findFirst.mockResolvedValue({ id: 'target-1', role: 'USER', deletedAt: null, blockedAt: null })
  prismaMock.user.count.mockResolvedValue(2)
  prismaMock.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))
  tx.user.count.mockResolvedValue(2)
  tx.user.update.mockResolvedValue({})
  tx.roleChangeLog.create.mockResolvedValue({})
})

describe('changeUserRole — permissions', () => {
  it('throws "Недостаточно прав" when called as ADMIN', async () => {
    authMock.mockResolvedValue(ADMIN_SESSION)
    await expect(changeUserRole('target-1', 'ADMIN')).rejects.toThrow('Недостаточно прав')
  })
})

describe('changeUserRole — guards', () => {
  it('throws when targetUserId equals current user id (self-change)', async () => {
    await expect(changeUserRole('su-1', 'ADMIN')).rejects.toThrow()
  })

  it('throws when demoting the last SUPERADMIN', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'target-1', role: 'SUPERADMIN', deletedAt: null })
    prismaMock.user.count.mockResolvedValue(1)
    await expect(changeUserRole('target-1', 'ADMIN')).rejects.toThrow()
  })
})

describe('changeUserRole — happy path', () => {
  it('executes a prisma.$transaction for a valid role change', async () => {
    await changeUserRole('target-1', 'ADMIN')
    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it('writes both User.role update and RoleChangeLog inside the transaction', async () => {
    await changeUserRole('target-1', 'ADMIN')
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'ADMIN' }) })
    )
    expect(tx.roleChangeLog.create).toHaveBeenCalled()
  })
})

describe('blockUser', () => {
  it('throws when blocking would leave 0 non-blocked SUPERADMINs', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'target-1', role: 'SUPERADMIN', deletedAt: null, blockedAt: null })
    prismaMock.user.count.mockResolvedValue(1)
    await expect(blockUser('target-1')).rejects.toThrow()
  })

  it('throws when blocking self', async () => {
    await expect(blockUser('su-1')).rejects.toThrow()
  })
})
