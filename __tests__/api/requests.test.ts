import { describe, it, expect, vi, beforeEach } from 'vitest'

const { expeditionFindUniqueMock, requestCreateMock } = vi.hoisted(() => ({
  expeditionFindUniqueMock: vi.fn(),
  requestCreateMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    expedition: { findUnique: expeditionFindUniqueMock },
    request: { create: requestCreateMock },
  },
}))

import { POST } from '@/app/api/requests/route'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_NOT_FOUND,
} from '@/lib/constants'

const EXPEDITION_ID = '00000000-0000-4000-8000-000000000001'
const ACTIVE_EXPEDITION = { id: EXPEDITION_ID, status: 'ACTIVE' }
const CREATED_REQUEST = { id: '00000000-0000-4000-8000-000000000002' }

function makePost(body: unknown) {
  return new Request('http://localhost/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  expeditionFindUniqueMock.mockResolvedValue(ACTIVE_EXPEDITION)
  requestCreateMock.mockResolvedValue(CREATED_REQUEST)
})

// ─── SC1: valid EXPEDITION body ───────────────────────────────────────────────

describe('POST /api/requests — EXPEDITION happy path', () => {
  it('returns 201 with { id } for a valid EXPEDITION request', async () => {
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина Смехова',
      email: 'polina@example.com',
      message: 'Хочу присоединиться',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ id: CREATED_REQUEST.id })
  })

  it('creates DB row with type EXPEDITION, status NEW, correct expeditionId', async () => {
    await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина Смехова',
      email: 'polina@example.com',
      message: 'Хочу присоединиться',
    }))
    expect(requestCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'EXPEDITION',
          expeditionId: EXPEDITION_ID,
          status: 'NEW',
          name: 'Полина Смехова',
          email: 'polina@example.com',
        }),
      }),
    )
  })

  it('accepts EXPEDITION request without message (message is optional)', async () => {
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина Смехова',
      email: 'polina@example.com',
    }))
    expect(res.status).toBe(201)
  })

  it('accepts EXPEDITION request with empty message (treats as omitted)', async () => {
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина Смехова',
      email: 'polina@example.com',
      message: '',
    }))
    expect(res.status).toBe(201)
  })
})

// ─── SC2: valid PRIVATE_WALK body ─────────────────────────────────────────────

describe('POST /api/requests — PRIVATE_WALK happy path', () => {
  it('returns 201 with { id } for a valid PRIVATE_WALK request', async () => {
    const res = await POST(makePost({
      type: 'PRIVATE_WALK',
      name: 'Иван Иванов',
      email: 'ivan@example.com',
      message: 'Хочу организовать прогулку',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ id: CREATED_REQUEST.id })
  })

  it('creates DB row with type PRIVATE_WALK, status NEW, expeditionId null', async () => {
    await POST(makePost({
      type: 'PRIVATE_WALK',
      name: 'Иван Иванов',
      email: 'ivan@example.com',
      message: 'Хочу организовать прогулку',
    }))
    expect(requestCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'PRIVATE_WALK',
          expeditionId: null,
          status: 'NEW',
        }),
      }),
    )
  })

  it('does not call expedition lookup for PRIVATE_WALK', async () => {
    const res = await POST(makePost({
      type: 'PRIVATE_WALK',
      name: 'Иван Иванов',
      email: 'ivan@example.com',
      message: 'Хочу организовать прогулку',
    }))
    expect(res.status).toBe(201)
    expect(expeditionFindUniqueMock).not.toHaveBeenCalled()
  })
})

// ─── SC3: EXPEDITION with no expeditionId ────────────────────────────────────

describe('POST /api/requests — EXPEDITION validation', () => {
  it('returns 400 when type=EXPEDITION and expeditionId is missing', async () => {
    const res = await POST(makePost({
      type: 'EXPEDITION',
      name: 'Полина',
      email: 'polina@example.com',
      message: 'Хочу',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  // ─── SC4: non-existent expeditionId ───────────────────────────────────────
  it('returns 404 when expeditionId references no row', async () => {
    expeditionFindUniqueMock.mockResolvedValue(null)
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина',
      email: 'polina@example.com',
    }))
    expect(res.status).toBe(HTTP_STATUS_NOT_FOUND)
  })

  // ─── SC5: expedition exists but status !== ACTIVE ─────────────────────────
  it('returns 404 when expedition status is DRAFT (not leaked)', async () => {
    expeditionFindUniqueMock.mockResolvedValue({ id: EXPEDITION_ID, status: 'DRAFT' })
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина',
      email: 'polina@example.com',
    }))
    expect(res.status).toBe(HTTP_STATUS_NOT_FOUND)
  })

  it('returns 404 when expedition status is CANCELLED (not leaked)', async () => {
    expeditionFindUniqueMock.mockResolvedValue({ id: EXPEDITION_ID, status: 'CANCELLED' })
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина',
      email: 'polina@example.com',
    }))
    expect(res.status).toBe(HTTP_STATUS_NOT_FOUND)
  })
})

// ─── SC6–8: field validation ─────────────────────────────────────────────────

describe('POST /api/requests — required field validation', () => {
  it('returns 400 when name is missing', async () => {
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      email: 'polina@example.com',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 for an invalid email format', async () => {
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'Полина',
      email: 'not-an-email',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 when name exceeds 100 chars', async () => {
    const res = await POST(makePost({
      type: 'EXPEDITION',
      expeditionId: EXPEDITION_ID,
      name: 'А'.repeat(101),
      email: 'polina@example.com',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })
})

// ─── SC9: PRIVATE_WALK requires message ──────────────────────────────────────

describe('POST /api/requests — PRIVATE_WALK validation', () => {
  it('returns 400 when type=PRIVATE_WALK and message is missing', async () => {
    const res = await POST(makePost({
      type: 'PRIVATE_WALK',
      name: 'Иван',
      email: 'ivan@example.com',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 when type=PRIVATE_WALK and message is empty string', async () => {
    const res = await POST(makePost({
      type: 'PRIVATE_WALK',
      name: 'Иван',
      email: 'ivan@example.com',
      message: '',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  // ─── SC10: PRIVATE_WALK with expeditionId supplied ────────────────────────
  it('returns 400 when type=PRIVATE_WALK and expeditionId is supplied', async () => {
    const res = await POST(makePost({
      type: 'PRIVATE_WALK',
      expeditionId: EXPEDITION_ID,
      name: 'Иван',
      email: 'ivan@example.com',
      message: 'Хочу прогулку',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })
})

// ─── general body validation ──────────────────────────────────────────────────

describe('POST /api/requests — general validation', () => {
  it('returns 400 for an unknown type', async () => {
    const res = await POST(makePost({
      type: 'UNKNOWN',
      name: 'Иван',
      email: 'ivan@example.com',
      message: 'Хочу',
    }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('returns 400 for an empty body', async () => {
    const res = await POST(makePost({}))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })

  it('does not call request.create on validation failure', async () => {
    const res = await POST(makePost({ type: 'EXPEDITION', name: 'Полина', email: 'bad' }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(requestCreateMock).not.toHaveBeenCalled()
  })
})
