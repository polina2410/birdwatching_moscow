import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { blockUser, unblockUser, getUserRoleHistory } from '@/app/admin/users/_actions'

const mockAuth = vi.mocked(auth)
const mockPrismaUser = vi.mocked(prisma.user)
const mockRoleChangeLog = vi.mocked(prisma.roleChangeLog)

function makeSession(role: 'USER' | 'ADMIN' | 'SUPERADMIN', id = 'actor-1') {
  return { user: { id, role, name: 'Test', email: 'test@test.com' }, expires: '' }
}

describe('blockUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('succeeds when ADMIN blocks a USER-role user', async () => {
    mockAuth.mockResolvedValue(makeSession('ADMIN'))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: 'USER' } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(blockUser('target-1')).resolves.toBeUndefined()
  })

  it('succeeds when ADMIN blocks an ADMIN-role user', async () => {
    mockAuth.mockResolvedValue(makeSession('ADMIN'))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: 'ADMIN' } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(blockUser('target-2')).resolves.toBeUndefined()
  })

  it('throws when ADMIN tries to block a SUPERADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession('ADMIN'))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: 'SUPERADMIN' } as never)

    await expect(blockUser('super-1')).rejects.toThrow('Нельзя заблокировать суперадмина.')
  })

  it('throws Forbidden when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    await expect(blockUser('target-1')).rejects.toThrow('Forbidden')
  })
})

describe('unblockUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('succeeds when ADMIN unblocks a USER-role user', async () => {
    mockAuth.mockResolvedValue(makeSession('ADMIN'))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: 'USER' } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(unblockUser('target-1')).resolves.toBeUndefined()
  })

  it('succeeds when ADMIN unblocks an ADMIN-role user', async () => {
    mockAuth.mockResolvedValue(makeSession('ADMIN'))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: 'ADMIN' } as never)
    mockPrismaUser.update.mockResolvedValue({} as never)

    await expect(unblockUser('target-2')).resolves.toBeUndefined()
  })

  it('throws when ADMIN tries to unblock a SUPERADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession('ADMIN'))
    mockPrismaUser.findUniqueOrThrow.mockResolvedValue({ role: 'SUPERADMIN' } as never)

    await expect(unblockUser('super-1')).rejects.toThrow('Нельзя заблокировать суперадмина.')
  })

  it('throws Forbidden when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)

    await expect(unblockUser('target-1')).rejects.toThrow('Forbidden')
  })
})

describe('getUserRoleHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('succeeds when called by ADMIN', async () => {
    mockAuth.mockResolvedValue(makeSession('ADMIN'))
    mockRoleChangeLog.findMany.mockResolvedValue([] as never)

    await expect(getUserRoleHistory('target-1')).resolves.toEqual([])
  })

  it('throws Forbidden when called by USER', async () => {
    mockAuth.mockResolvedValue(makeSession('USER'))

    await expect(getUserRoleHistory('target-1')).rejects.toThrow('Forbidden')
  })
})