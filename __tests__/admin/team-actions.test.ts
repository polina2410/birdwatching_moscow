import { describe, it, expect, vi, beforeEach } from 'vitest'

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: authMock }))

const teamMemberMock = { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }
const walkMock = { count: vi.fn() }
const expeditionMock = { count: vi.fn() }

vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: teamMemberMock,
    walk: walkMock,
    expedition: expeditionMock,
  },
}))

import { deleteTeamMember } from '@/app/admin/team/_actions'

const ADMIN_SESSION = { user: { id: 'u1', role: 'ADMIN' as const, name: 'Admin' } }

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(ADMIN_SESSION)
  teamMemberMock.findFirst.mockResolvedValue({ id: 1, name: 'Guide' })
})

describe('deleteTeamMember', () => {
  it('throws with "гидом на" when member is assigned as guide on walks or expeditions', async () => {
    walkMock.count.mockResolvedValue(2)
    expeditionMock.count.mockResolvedValue(1)
    await expect(deleteTeamMember(1)).rejects.toThrow(/гидом на/)
  })

  it('throws even when assigned only to walks (count > 0)', async () => {
    walkMock.count.mockResolvedValue(1)
    expeditionMock.count.mockResolvedValue(0)
    await expect(deleteTeamMember(1)).rejects.toThrow(/гидом на/)
  })

  it('throws even when assigned only to expeditions (count > 0)', async () => {
    walkMock.count.mockResolvedValue(0)
    expeditionMock.count.mockResolvedValue(1)
    await expect(deleteTeamMember(1)).rejects.toThrow(/гидом на/)
  })

  it('deletes when member is not assigned to any events', async () => {
    walkMock.count.mockResolvedValue(0)
    expeditionMock.count.mockResolvedValue(0)
    teamMemberMock.delete.mockResolvedValue({ id: 1 })
    await deleteTeamMember(1)
    expect(teamMemberMock.delete).toHaveBeenCalled()
  })
})
