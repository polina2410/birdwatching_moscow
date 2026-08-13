import { describe, it, expect, vi, beforeEach } from 'vitest'

const { applyPaymentResultMock } = vi.hoisted(() => ({
  applyPaymentResultMock: vi.fn(),
}))

vi.mock('@/lib/payments/applyPaymentResult', () => ({
  applyPaymentResult: applyPaymentResultMock,
}))

// Allow-listed IP used in tests — matches the constant in the implementation
const ALLOWED_IP = '185.71.76.0'
const BLOCKED_IP = '1.2.3.4'

vi.mock('@/lib/payments/yookassa/allowlist', () => ({
  YOOKASSA_IP_ALLOWLIST: [ALLOWED_IP],
}))

import { POST } from '@/app/api/payments/yookassa/webhook/route'
import { HTTP_METHOD, JSON_HEADERS, HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_FORBIDDEN } from '@/lib/constants'

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    type: 'notification',
    event: 'payment.succeeded',
    object: {
      id: 'pay-abc',
      status: 'succeeded',
      amount: { value: '1500.00', currency: 'RUB' },
      metadata: { orderId: 'order-1' },
      ...(overrides.object as Record<string, unknown> | undefined),
    },
    ...overrides,
  }
}

function makeRequest(body: unknown, ip = ALLOWED_IP) {
  return new Request('http://localhost/api/payments/yookassa/webhook', {
    method: HTTP_METHOD.POST,
    headers: { ...JSON_HEADERS, 'X-Real-IP': ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.YOOKASSA_VERIFY_IP = 'true'
  applyPaymentResultMock.mockResolvedValue(undefined)
})

describe('POST /api/payments/yookassa/webhook — IP allowlist', () => {
  it('returns 403 for an IP outside the allowlist', async () => {
    const res = await POST(makeRequest(makeNotification(), BLOCKED_IP))
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN)
    expect(applyPaymentResultMock).not.toHaveBeenCalled()
  })

  it('processes request from an allowed IP', async () => {
    const res = await POST(makeRequest(makeNotification(), ALLOWED_IP))
    expect(res.status).toBe(200)
  })

  it('skips IP check when YOOKASSA_VERIFY_IP=false', async () => {
    process.env.YOOKASSA_VERIFY_IP = 'false'
    const res = await POST(makeRequest(makeNotification(), BLOCKED_IP))
    expect(res.status).toBe(200)
  })

  it('returns 403 when X-Real-IP header is absent', async () => {
    const req = new Request('http://localhost/api/payments/yookassa/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeNotification()),
    })
    const res = await POST(req)
    expect(res.status).toBe(HTTP_STATUS_FORBIDDEN)
    expect(applyPaymentResultMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/payments/yookassa/webhook — schema validation', () => {
  it('returns 400 for a body that fails Zod validation', async () => {
    const res = await POST(makeRequest({ type: 'notification', event: 'payment.succeeded' /* missing object */ }))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
    expect(applyPaymentResultMock).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-object body', async () => {
    const res = await POST(makeRequest('invalid'))
    expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST)
  })
})

describe('POST /api/payments/yookassa/webhook — payment.succeeded', () => {
  it('returns 200 and calls applyPaymentResult', async () => {
    const res = await POST(makeRequest(makeNotification()))
    expect(res.status).toBe(200)
    expect(applyPaymentResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay-abc',
        status: 'succeeded',
        amountKopecks: 150000,
      })
    )
  })

  it('returns 200 on duplicate delivery without error', async () => {
    await POST(makeRequest(makeNotification()))
    const res = await POST(makeRequest(makeNotification()))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/payments/yookassa/webhook — payment.canceled', () => {
  it('calls applyPaymentResult with status canceled', async () => {
    const res = await POST(
      makeRequest(
        makeNotification({
          event: 'payment.canceled',
          object: { id: 'pay-abc', status: 'canceled', amount: { value: '1500.00', currency: 'RUB' }, metadata: { orderId: 'order-1' } },
        })
      )
    )
    expect(res.status).toBe(200)
    expect(applyPaymentResultMock).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay-abc', status: 'canceled' })
    )
  })
})

describe('POST /api/payments/yookassa/webhook — payment.waiting_for_capture', () => {
  it('returns 200 but does not call applyPaymentResult', async () => {
    const res = await POST(
      makeRequest({
        type: 'notification',
        event: 'payment.waiting_for_capture',
        object: {
          id: 'pay-abc',
          status: 'waiting_for_capture',
          amount: { value: '1500.00', currency: 'RUB' },
          metadata: { orderId: 'order-1' },
        },
      })
    )
    expect(res.status).toBe(200)
    expect(applyPaymentResultMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/payments/yookassa/webhook — unknown events', () => {
  it('returns 200 for an unknown payment id (no DB write)', async () => {
    applyPaymentResultMock.mockResolvedValue(undefined)
    const res = await POST(
      makeRequest(
        makeNotification({ object: { id: 'unknown-pay', status: 'succeeded', amount: { value: '0.01', currency: 'RUB' }, metadata: {} } })
      )
    )
    expect(res.status).toBe(200)
  })

  it('returns 200 for refund.succeeded (accepted but only logged)', async () => {
    const res = await POST(
      makeRequest({
        type: 'notification',
        event: 'refund.succeeded',
        object: {
          id: 'refund-1',
          payment_id: 'pay-abc',
          status: 'succeeded',
          amount: { value: '1500.00', currency: 'RUB' },
        },
      })
    )
    expect(res.status).toBe(200)
  })
})
