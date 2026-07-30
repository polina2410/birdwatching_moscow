import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, checkRateLimitMock, createPaymentMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  createPaymentMock: vi.fn(),
}))

const txMock = {
  cartItem: { findMany: vi.fn(), deleteMany: vi.fn() },
  walk: { findMany: vi.fn() },
  ticket: { count: vi.fn() },
  orderItem: { findMany: vi.fn() },
  order: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}
const prismaMock = {
  $transaction: vi.fn().mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
}

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: checkRateLimitMock }))
vi.mock('@/lib/payments/yookassa', () => ({ createPayment: createPaymentMock }))

import { POST } from '@/app/api/checkout/route'

const SESSION = { user: { id: 'user-1', email: 'a@test.com', name: 'A', role: 'USER' } }
const WALK = { id: 'walk-1', title: 'Лесная прогулка', priceKopecks: 75000, capacity: 10 }
const NOW = new Date()
const FUTURE = new Date(NOW.getTime() + 20 * 60 * 1000)
const PAST = new Date(NOW.getTime() - 1)
const CART_ITEMS = [{ id: 'cart-1', walkId: 'walk-1', quantity: 2, reservedUntil: FUTURE }]
const ORDER = { id: 'order-1', totalKopecks: 150000, status: 'PENDING', yooKassaPaymentId: null }

function makeRequest(body = {}) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue(SESSION)
  checkRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  txMock.cartItem.findMany.mockResolvedValue(CART_ITEMS)
  txMock.walk.findMany.mockResolvedValue([WALK])
  txMock.ticket.count.mockResolvedValue(0)
  txMock.orderItem.findMany.mockResolvedValue([])
  txMock.order.create.mockResolvedValue(ORDER)
  txMock.order.findFirst.mockResolvedValue(null)
  txMock.order.update.mockResolvedValue({ ...ORDER, status: 'AWAITING_PAYMENT', yooKassaPaymentId: 'pay-abc' })
  txMock.cartItem.deleteMany.mockResolvedValue({ count: 1 })
  createPaymentMock.mockResolvedValue({
    id: 'pay-abc',
    status: 'pending',
    confirmationUrl: 'https://yookassa.ru/checkout/...',
  })
})

describe('POST /api/checkout — auth', () => {
  it('returns 401 when not authenticated', async () => {
    authMock.mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })
})

describe('POST /api/checkout — cart validation', () => {
  it('returns 409 CART_EMPTY when user has no cart items', async () => {
    txMock.cartItem.findMany.mockResolvedValue([])
    const res = await POST(makeRequest())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('CART_EMPTY')
  })

  it('returns 409 CART_EXPIRED when all cart items are expired', async () => {
    txMock.cartItem.findMany.mockResolvedValue([
      { ...CART_ITEMS[0], reservedUntil: PAST },
    ])
    const res = await POST(makeRequest())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('CART_EXPIRED')
  })

  it('returns 409 CAPACITY_EXCEEDED when walk is oversubscribed', async () => {
    // walk has capacity 10, 10 tickets already sold
    txMock.ticket.count.mockResolvedValue(10)
    const res = await POST(makeRequest())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('CAPACITY_EXCEEDED')
  })
})

describe('POST /api/checkout — happy path', () => {
  it('returns 200 with orderId and confirmationUrl', async () => {
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ orderId: 'order-1', confirmationUrl: expect.any(String) })
  })

  it('sets expiresAt to now + 20 minutes', async () => {
    await POST(makeRequest())
    const createCall = txMock.order.create.mock.calls[0][0] as {
      data: { expiresAt: Date }
    }
    const diffMs = createCall.data.expiresAt.getTime() - Date.now()
    expect(diffMs).toBeGreaterThan(19 * 60 * 1000)
    expect(diffMs).toBeLessThan(21 * 60 * 1000)
  })

  it('computes totalKopecks from DB — not from request body', async () => {
    // client sends wrong prices; server must compute from Walk.priceKopecks
    const res = await POST(makeRequest({ totalKopecks: 0, priceKopecks: 0 }))
    expect(res.status).toBe(200)

    const createCall = txMock.order.create.mock.calls[0][0] as {
      data: { totalKopecks: number }
    }
    // 2 seats × 75000 kopecks = 150000
    expect(createCall.data.totalKopecks).toBe(150000)
  })

  it('deletes cart items inside the same transaction', async () => {
    await POST(makeRequest())
    expect(txMock.cartItem.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) })
    )
  })

  it('calls createPayment with Idempotence-Key equal to order.id', async () => {
    await POST(makeRequest())
    expect(createPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ idempotenceKey: 'order-1' })
    )
  })

  it('create-payment call has no payment_method_data', async () => {
    await POST(makeRequest())
    const call = createPaymentMock.mock.calls[0][0] as Record<string, unknown>
    expect(call.paymentMethodData).toBeUndefined()
  })

  it('create-payment call has capture: true', async () => {
    await POST(makeRequest())
    expect(createPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ capture: true })
    )
  })

  it('create-payment call has amount.currency: "RUB"', async () => {
    await POST(makeRequest())
    expect(createPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expect.objectContaining({ currency: 'RUB' }) })
    )
  })

  it('create-payment description is ≤ 128 chars', async () => {
    await POST(makeRequest())
    const call = createPaymentMock.mock.calls[0][0] as { description: string }
    expect(call.description.length).toBeLessThanOrEqual(128)
  })
})

describe('POST /api/checkout — provider failure', () => {
  it('returns 502 when ЮKassa returns 5xx', async () => {
    createPaymentMock.mockRejectedValue(Object.assign(new Error('Provider error'), { code: 'PROVIDER_5XX' }))
    const res = await POST(makeRequest())
    expect(res.status).toBe(502)
  })

  it('order stays PENDING with null yooKassaPaymentId on provider failure', async () => {
    createPaymentMock.mockRejectedValue(new Error('Timeout'))
    await POST(makeRequest())
    // order.update to AWAITING_PAYMENT must NOT have been called
    const awaitingCall = (txMock.order.update.mock.calls as Array<[{ data: { status?: string } }]>).find(
      ([args]) => args?.data?.status === 'AWAITING_PAYMENT'
    )
    expect(awaitingCall).toBeUndefined()
  })
})

describe('POST /api/checkout — rate limit', () => {
  it('returns 429 when rate limit is hit', async () => {
    checkRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
  })
})
