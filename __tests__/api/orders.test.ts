import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, orderFindUniqueMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  orderFindUniqueMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findUnique: orderFindUniqueMock } },
}))

import { GET } from '@/app/api/orders/[id]/route'
import { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_NOT_FOUND } from '@/lib/constants'

const OWNER_SESSION = { user: { id: 'user-owner', email: 'owner@test.com', role: 'USER' } }
const OTHER_SESSION = { user: { id: 'user-other', email: 'other@test.com', role: 'USER' } }
const ORDER = { id: 'order-1', userId: 'user-owner', status: 'AWAITING_PAYMENT' }

function makeRequest(orderId: string) {
  return {
    req: new Request(`http://localhost/api/orders/${orderId}`),
    context: { params: { id: orderId } },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(OWNER_SESSION)
  orderFindUniqueMock.mockResolvedValue(ORDER)
})

describe('GET /api/orders/[id] — auth', () => {
  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue(null)
    const { req, context } = makeRequest('order-1')
    const res = await GET(req, context)
    expect(res.status).toBe(HTTP_STATUS_UNAUTHORIZED)
  })
})

describe('GET /api/orders/[id] — authorization', () => {
  it('returns 200 with { status } for the order owner', async () => {
    const { req, context } = makeRequest('order-1')
    const res = await GET(req, context)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ status: 'AWAITING_PAYMENT' })
  })

  it('returns 404 for a different logged-in user', async () => {
    authMock.mockResolvedValue(OTHER_SESSION)
    const { req, context } = makeRequest('order-1')
    const res = await GET(req, context)
    expect(res.status).toBe(HTTP_STATUS_NOT_FOUND)
  })

  it('returns 404 when order does not exist', async () => {
    orderFindUniqueMock.mockResolvedValue(null)
    const { req, context } = makeRequest('order-does-not-exist')
    const res = await GET(req, context)
    expect(res.status).toBe(HTTP_STATUS_NOT_FOUND)
  })
})
