import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, teamMemberMock, walkMock, expeditionMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  teamMemberMock: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  walkMock: { count: vi.fn() },
  expeditionMock: { count: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({
  prisma: { teamMember: teamMemberMock, walk: walkMock, expedition: expeditionMock },
}))

import { createTeamMember, updateTeamMember, deleteTeamMember } from '@/app/admin/team/_actions'

const ADMIN_SESSION = { user: { id: 'u1', role: 'ADMIN' as const, name: 'Admin' } }

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(ADMIN_SESSION)
  teamMemberMock.findFirst.mockResolvedValue({ id: 1, name: 'Guide' })
})

const VALID_MEMBER_INPUT = {
  name: 'Guide Name',
  photoUrl: 'https://example.com/photo.jpg',
  profileLinks: [],
  sortOrder: 1,
}

describe('createTeamMember', () => {
  it('returns the new member id', async () => {
    teamMemberMock.create.mockResolvedValue({ id: 5 })
    const id = await createTeamMember(VALID_MEMBER_INPUT)
    expect(id).toBe(5)
  })
})

describe('updateTeamMember', () => {
  it('calls prisma.teamMember.update with the provided data', async () => {
    teamMemberMock.update.mockResolvedValue({ id: 1 })
    await updateTeamMember(1, VALID_MEMBER_INPUT)
    expect(teamMemberMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
  })
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
