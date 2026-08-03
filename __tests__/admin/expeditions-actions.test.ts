import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, expeditionMock, expeditionDayMock, requestMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  expeditionMock: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  expeditionDayMock: { deleteMany: vi.fn(), createMany: vi.fn() },
  requestMock: { count: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    expedition: expeditionMock,
    expeditionDay: expeditionDayMock,
    request: requestMock,
  },
}))

import {
  createExpedition,
  updateExpedition,
  publishExpedition,
  cancelExpedition,
  restoreExpedition,
  deleteExpedition,
} from '@/app/admin/expeditions/_actions'

const ADMIN_SESSION = { user: { id: 'u1', role: 'ADMIN' as const, name: 'Admin' } }
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const VALID_EXPEDITION_INPUT = {
  type: 'EXPEDITION' as const,
  title: 'Test Expedition',
  description: 'Description',
  startsAt: FUTURE,
  location: 'Mountains',
  coverPhotoUrl: 'https://example.com/photo.jpg',
  galleryUrls: ['https://example.com/g1.jpg', 'https://example.com/g2.jpg'],
  totalSpots: 10,
  spotsLeft: 10,
  guideIds: ['1', '2'],
  days: [{ clientId: 'day-1', dayNumber: 1, title: 'Day 1', description: 'Desc' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(ADMIN_SESSION)
  expeditionMock.create.mockResolvedValue({ id: 'exp-1' })
  expeditionMock.findFirst.mockResolvedValue(null)
})

describe('createExpedition — gallery URLs', () => {
  it('accepts galleryUrls with 5 or fewer items', async () => {
    const input = {
      ...VALID_EXPEDITION_INPUT,
      galleryUrls: Array.from({ length: 5 }, (_, i) => `https://example.com/g${i}.jpg`),
    }
    await expect(createExpedition(input)).resolves.not.toThrow()
  })

  it('rejects galleryUrls array longer than 5 items with error containing "не более 5"', async () => {
    const input = {
      ...VALID_EXPEDITION_INPUT,
      galleryUrls: Array.from({ length: 6 }, (_, i) => `https://example.com/g${i}.jpg`),
    }
    await expect(createExpedition(input)).rejects.toThrow(/не более 5/)
  })
})

describe('updateExpedition — gallery URLs', () => {
  it('rejects galleryUrls array longer than 5 items', async () => {
    const input = {
      ...VALID_EXPEDITION_INPUT,
      galleryUrls: Array.from({ length: 6 }, (_, i) => `https://example.com/g${i}.jpg`),
    }
    await expect(updateExpedition('exp-1', input)).rejects.toThrow(/не более 5/)
  })
})

const ACTIVE_EXPEDITION = {
  id: 'exp-1',
  status: 'ACTIVE' as const,
  startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  publishedAt: null,
  publishedBy: null,
}

const DRAFT_EXPEDITION = { ...ACTIVE_EXPEDITION, status: 'DRAFT' as const }
const CANCELLED_EXPEDITION = { ...ACTIVE_EXPEDITION, status: 'CANCELLED' as const }
const PAST_EXPEDITION = { ...CANCELLED_EXPEDITION, startsAt: new Date(Date.now() - 60 * 60 * 1000) }

describe('publishExpedition', () => {
  it('throws when expedition is already ACTIVE', async () => {
    expeditionMock.findFirst.mockResolvedValue(ACTIVE_EXPEDITION)
    await expect(publishExpedition('exp-1')).rejects.toThrow('Экспедиция уже опубликована')
  })

  it('calls expedition.update with ACTIVE when status is DRAFT', async () => {
    expeditionMock.findFirst.mockResolvedValue(DRAFT_EXPEDITION)
    expeditionMock.update.mockResolvedValue({})
    await publishExpedition('exp-1')
    expect(expeditionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
    )
  })
})

describe('cancelExpedition', () => {
  it('throws when expedition is not ACTIVE', async () => {
    expeditionMock.findFirst.mockResolvedValue(DRAFT_EXPEDITION)
    await expect(cancelExpedition('exp-1')).rejects.toThrow()
  })

  it('calls expedition.update with CANCELLED when expedition is ACTIVE', async () => {
    expeditionMock.findFirst.mockResolvedValue(ACTIVE_EXPEDITION)
    expeditionMock.update.mockResolvedValue({})
    await cancelExpedition('exp-1')
    expect(expeditionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) })
    )
  })
})

describe('restoreExpedition', () => {
  it('throws when startsAt is in the past and no newStartsAt provided', async () => {
    expeditionMock.findFirst.mockResolvedValue(PAST_EXPEDITION)
    await expect(restoreExpedition('exp-1')).rejects.toThrow()
  })

  it('calls expedition.update with DRAFT when a future newStartsAt is provided', async () => {
    expeditionMock.findFirst.mockResolvedValue(PAST_EXPEDITION)
    expeditionMock.update.mockResolvedValue({})
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await restoreExpedition('exp-1', futureDate)
    expect(expeditionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) })
    )
  })
})

describe('deleteExpedition', () => {
  it('throws when linked requests exist', async () => {
    requestMock.count.mockResolvedValue(1)
    await expect(deleteExpedition('exp-1')).rejects.toThrow('Нельзя удалить экспедицию с заявками.')
  })

  it('calls expedition.update with DELETED when no requests exist', async () => {
    requestMock.count.mockResolvedValue(0)
    expeditionMock.update.mockResolvedValue({})
    await deleteExpedition('exp-1')
    expect(expeditionMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DELETED' }) })
    )
  })
})
