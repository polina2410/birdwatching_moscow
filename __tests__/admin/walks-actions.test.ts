import { describe, it, expect, vi, beforeEach } from 'vitest'

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: authMock }))

const walkMock = { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }
const ticketMock = { count: vi.fn() }
const cartItemMock = { aggregate: vi.fn() }

vi.mock('@/lib/prisma', () => ({
  prisma: {
    walk: walkMock,
    ticket: ticketMock,
    cartItem: cartItemMock,
  },
}))

import {
  createWalk,
  updateWalk,
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
    cartItemMock.aggregate.mockResolvedValue({ _count: { id: 0 }, _max: { reservedUntil: null } })
    await expect(deleteWalk('walk-1')).rejects.toThrow(/проданными билетами/)
  })

  it('calls walk.update with status DELETED when no tickets and no active cart items', async () => {
    walkMock.findFirst.mockResolvedValue({ id: 'walk-1', status: 'DRAFT' })
    ticketMock.count.mockResolvedValue(0)
    cartItemMock.aggregate.mockResolvedValue({ _count: { id: 0 }, _max: { reservedUntil: null } })
    walkMock.update.mockResolvedValue({ id: 'walk-1', status: 'DELETED' })
    await deleteWalk('walk-1')
    expect(walkMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DELETED' }),
      })
    )
  })
})

describe('restoreWalk', () => {
  it('throws when startsAt is in the past and no newStartsAt is provided', async () => {
    walkMock.findFirst.mockResolvedValue({ id: 'walk-1', status: 'CANCELLED', startsAt: new Date(PAST) })
    await expect(restoreWalk('walk-1')).rejects.toThrow()
  })
})
