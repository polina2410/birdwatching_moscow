import { describe, it, expect, vi, beforeEach } from 'vitest'

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: authMock }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    expedition: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    expeditionDay: { deleteMany: vi.fn(), createMany: vi.fn() },
    request: { count: vi.fn() },
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
})

describe('createExpedition — gallery URLs', () => {
  it('accepts galleryUrls with 5 or fewer items', async () => {
    const { prisma } = await import('@/lib/prisma')
    const expMock = prisma.expedition as { create: ReturnType<typeof vi.fn> }
    expMock.create.mockResolvedValue({ id: 'exp-1' })
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
