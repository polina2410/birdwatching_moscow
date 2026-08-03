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

import { createExpedition, updateExpedition } from '@/app/admin/expeditions/_actions'

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
