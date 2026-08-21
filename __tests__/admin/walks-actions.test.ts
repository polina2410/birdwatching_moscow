import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, walkMock, ticketMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  walkMock: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  ticketMock: { count: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({
  prisma: { walk: walkMock, ticket: ticketMock },
}))

import {
  createWalk,
  updateWalk,
  cancelWalk,
  publishWalk,
  deleteWalk,
  restoreWalk,
} from '@/app/admin/walks/_actions'

const ADMIN_SESSION = { user: { id: 'u1', role: 'ADMIN' as const, name: 'Admin' } }
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString()

const VALID_WALK_INPUT = {
  type: 'WALK' as const,
  title: 'Test Walk',
  description: 'Description',
  startsAt: FUTURE,
  location: 'Forest',
  coverPhotoUrl: 'https://example.com/photo.jpg',
  galleryUrl: 'https://example.com/gallery.jpg',
  priceKopecks: 50000,
  capacity: 10,
  guideId: 1,
  slug: 'test-walk',
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(ADMIN_SESSION)
})

describe('createWalk — permissions', () => {
  it('throws "Недостаточно прав" when unauthenticated', async () => {
    authMock.mockResolvedValue(null)
    await expect(createWalk(VALID_WALK_INPUT)).rejects.toThrow('Недостаточно прав')
  })

  it('throws "Недостаточно прав" when called as USER', async () => {
    authMock.mockResolvedValue({ user: { id: 'u3', role: 'USER', name: 'U' } })
    await expect(createWalk(VALID_WALK_INPUT)).rejects.toThrow('Недостаточно прав')
  })
})

describe('updateWalk — permissions', () => {
  it('throws "Недостаточно прав" when unauthenticated', async () => {
    authMock.mockResolvedValue(null)
    await expect(updateWalk('walk-1', VALID_WALK_INPUT)).rejects.toThrow('Недостаточно прав')
  })
})

describe('createWalk — gallery', () => {
  it('persists galleryUrl when provided', async () => {
    walkMock.findFirst.mockResolvedValue(null)
    walkMock.create.mockResolvedValue({ id: 'walk-1' })
    await createWalk(VALID_WALK_INPUT)
    expect(walkMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ galleryUrl: 'https://example.com/gallery.jpg' }),
      })
    )
  })

  it('persists null when galleryUrl is omitted', async () => {
    walkMock.findFirst.mockResolvedValue(null)
    walkMock.create.mockResolvedValue({ id: 'walk-1' })
    const { galleryUrl: _, ...inputWithout } = VALID_WALK_INPUT
    await createWalk(inputWithout)
    expect(walkMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ galleryUrl: null }),
      })
    )
  })
})

describe('publishWalk', () => {
  it('throws "Прогулка уже опубликована" when status is already ACTIVE', async () => {
    walkMock.findFirst.mockResolvedValue({ id: 'walk-1', status: 'ACTIVE' })
    await expect(publishWalk('walk-1')).rejects.toThrow('Прогулка уже опубликована')
  })
})

describe('deleteWalk', () => {
  it('throws when ticket count is greater than 0', async () => {
    walkMock.findFirst.mockResolvedValue({ id: 'walk-1', status: 'DRAFT' })
    ticketMock.count.mockResolvedValue(1)
    await expect(deleteWalk('walk-1')).rejects.toThrow(/проданными билетами/)
  })

  it('calls walk.update with status DELETED when no tickets sold', async () => {
    walkMock.findFirst.mockResolvedValue({ id: 'walk-1', status: 'DRAFT' })
    ticketMock.count.mockResolvedValue(0)
    walkMock.update.mockResolvedValue({ id: 'walk-1', status: 'DELETED' })
    await deleteWalk('walk-1')
    expect(walkMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DELETED' }),
      })
    )
  })
})

describe('updateWalk — happy path', () => {
  it('calls prisma.walk.update with the provided fields', async () => {
    walkMock.update.mockResolvedValue({ id: 'walk-1' })
    await updateWalk('walk-1', VALID_WALK_INPUT)
    expect(walkMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'walk-1' } })
    )
  })
})

describe('createWalk — auto-slug', () => {
  it('calls prisma.walk.create even when no slug is provided (auto-generates one)', async () => {
    walkMock.findFirst.mockResolvedValue(null)
    walkMock.create.mockResolvedValue({ id: 'walk-2' })
    const { slug: _slug, ...inputWithoutSlug } = VALID_WALK_INPUT
    await createWalk(inputWithoutSlug)
    expect(walkMock.create).toHaveBeenCalled()
  })
})

describe('cancelWalk', () => {
  it('throws when walk status is not ACTIVE', async () => {
    walkMock.findFirst.mockResolvedValue({ id: 'walk-1', status: 'DRAFT' })
    await expect(cancelWalk('walk-1')).rejects.toThrow()
  })

  it('calls walk.update with CANCELLED when walk is ACTIVE', async () => {
    walkMock.findFirst.mockResolvedValue({ id: 'walk-1', status: 'ACTIVE' })
    walkMock.update.mockResolvedValue({ id: 'walk-1', status: 'CANCELLED' })
    await cancelWalk('walk-1')
    expect(walkMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) })
    )
  })
})


describe('restoreWalk', () => {
  it('throws when startsAt is in the past and no newStartsAt is provided', async () => {
    walkMock.findFirst.mockResolvedValue({ id: 'walk-1', status: 'CANCELLED', startsAt: new Date(PAST) })
    await expect(restoreWalk('walk-1')).rejects.toThrow()
  })
})
