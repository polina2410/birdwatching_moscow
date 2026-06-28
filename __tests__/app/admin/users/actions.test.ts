import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Role } from '@/generated/prisma/client'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    roleChangeLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { blockUser, unblockUser, getUserRoleHistory, changeUserRole } from '@/app/admin/users/_actions'

const mockAuth = vi.mocked(auth)
const mockPrismaUser = vi.mocked(prisma.user)
const mockRoleChangeLog = vi.mocked(prisma.roleChangeLog)

function makeSession(role: Role, id = 'actor-1') {
  return { user: { id, role, name: 'Test', email: 'test@test.com' }, expires: '' }
}

describe('blockUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('succeeds when ADMIN blocks a USER-role user', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.USER } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(blockUser('target-1')).resolves.toBeUndefined()
  })

  it('succeeds when ADMIN blocks an ADMIN-role user', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.ADMIN } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(blockUser('target-2')).resolves.toBeUndefined()
  })

  it('throws when ADMIN tries to block a SUPERADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.SUPERADMIN } as never)

    await expect(blockUser('super-1')).rejects.toThrow('Нельзя заблокировать суперадмина.')
  })

  it('throws when actor tries to block themselves', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN, 'actor-1'))

    await expect(blockUser('actor-1')).rejects.toThrow('Нельзя заблокировать себя.')
  })

  it('throws when SUPERADMIN tries to block the last active SUPERADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.SUPERADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.SUPERADMIN } as never)
    mockPrismaUser.count.mockResolvedValue(1 as never)

    await expect(blockUser('super-1')).rejects.toThrow('Нельзя заблокировать последнего активного SUPERADMIN.')
  })

  it('succeeds when SUPERADMIN blocks a SUPERADMIN with multiple active SUPERADMINs', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.SUPERADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.SUPERADMIN } as never)
    mockPrismaUser.count.mockResolvedValue(2 as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(blockUser('super-2')).resolves.toBeUndefined()
  })

  it('throws Forbidden when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    await expect(blockUser('target-1')).rejects.toThrow('Forbidden')
  })
})

describe('unblockUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('succeeds when ADMIN unblocks a USER-role user', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.USER } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(unblockUser('target-1')).resolves.toBeUndefined()
  })

  it('succeeds when ADMIN unblocks an ADMIN-role user', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.ADMIN } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(unblockUser('target-2')).resolves.toBeUndefined()
  })

  it('throws when ADMIN tries to unblock a SUPERADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.SUPERADMIN } as never)

    await expect(unblockUser('super-1')).rejects.toThrow('Нельзя заблокировать суперадмина.')
  })

  it('succeeds when SUPERADMIN unblocks a SUPERADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.SUPERADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.SUPERADMIN } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(unblockUser('super-2')).resolves.toBeUndefined()
  })

  it('throws Forbidden when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    await expect(unblockUser('target-1')).rejects.toThrow('Forbidden')
  })
})

describe('changeUserRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Forbidden when called by ADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN))

    await expect(changeUserRole('target-1', Role.SUPERADMIN)).rejects.toThrow('Forbidden')
  })

  it('throws when actor tries to change their own role', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.SUPERADMIN, 'actor-1'))

    await expect(changeUserRole('actor-1', Role.ADMIN)).rejects.toThrow('Нельзя изменить собственную роль.')
  })

  it('throws when target user is deleted', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.SUPERADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.ADMIN, deletedAt: new Date() } as never)

    await expect(changeUserRole('target-1', Role.USER)).rejects.toThrow('Нельзя изменить роль удалённого пользователя.')
  })

  it('throws when trying to demote the last SUPERADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.SUPERADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.SUPERADMIN, deletedAt: null } as never)
    mockPrismaUser.count.mockResolvedValue(1 as never)

    await expect(changeUserRole('target-1', Role.ADMIN)).rejects.toThrow('Нельзя понизить последнего SUPERADMIN.')
  })

  it('succeeds when demoting a SUPERADMIN with multiple existing', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.SUPERADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.SUPERADMIN, deletedAt: null } as never)
    mockPrismaUser.count.mockResolvedValue(2 as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never)

    await expect(changeUserRole('target-1', Role.ADMIN)).resolves.toBeUndefined()
  })

  it('succeeds when promoting a regular user to ADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.SUPERADMIN))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: Role.USER, deletedAt: null } as never)
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never)

    await expect(changeUserRole('target-1', Role.ADMIN)).resolves.toBeUndefined()
  })
})

describe('getUserRoleHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('succeeds when called by ADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.ADMIN))
    mockRoleChangeLog.findMany.mockResolvedValue([] as never)

    await expect(getUserRoleHistory('target-1')).resolves.toEqual([])
  })

  it('throws Forbidden when called by USER', async () => {
    mockAuth.mockResolvedValue(makeSession(Role.USER))

    await expect(getUserRoleHistory('target-1')).rejects.toThrow('Forbidden')
  })
})
