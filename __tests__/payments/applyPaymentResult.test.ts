import { describe, it, expect, vi, beforeEach } from 'vitest'

const { sendMailMock, prismaMock } = vi.hoisted(() => {
  const txMock = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ticket: {
      createMany: vi.fn(),
      count: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
  }
  return {
    sendMailMock: vi.fn(),
    prismaMock: {
      $transaction: vi.fn().mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
      user: {
        findUnique: vi.fn(),
      },
      _tx: txMock,
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/mail', () => ({ sendMail: sendMailMock }))

import { applyPaymentResult } from '@/lib/payments/applyPaymentResult'

const tx = ((prismaMock as unknown as { _tx: unknown })._tx) as {
  order: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  ticket: { createMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> }
  orderItem: { findMany: ReturnType<typeof vi.fn> }
  $executeRaw: ReturnType<typeof vi.fn>
}

const baseOrder = {
  id: 'order-1',
  userId: 'user-1',
  status: 'AWAITING_PAYMENT',
  totalKopecks: 150000,
  yooKassaPaymentId: 'pay-abc',
  expiresAt: new Date(Date.now() + 60_000),
  paidAt: null,
  paymentIssue: null,
}

const baseItems = [
  { id: 'item-1', walkId: 'walk-1', quantity: 2, unitPriceKopecks: 75000 },
]

beforeEach(() => {
  vi.clearAllMocks()
  tx.order.findUnique.mockResolvedValue(baseOrder)
  tx.order.update.mockResolvedValue({ ...baseOrder })
  tx.ticket.createMany.mockResolvedValue({ count: 2 })
  tx.ticket.count.mockResolvedValue(0)
  tx.orderItem.findMany.mockResolvedValue(baseItems)
  tx.$executeRaw.mockResolvedValue(undefined)
  sendMailMock.mockResolvedValue(undefined)
  prismaMock.user.findUnique.mockResolvedValue({ email: 'buyer@example.com' })
})

describe('applyPaymentResult — succeeded', () => {
  it('transitions order from AWAITING_PAYMENT to PAID and sets paidAt', async () => {
    await applyPaymentResult({
      paymentId: 'pay-abc',
      status: 'succeeded',
      amountKopecks: 150000,
    })

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({ status: 'PAID', paidAt: expect.any(Date) }),
      })
    )
  })

  it('creates one Ticket per seat (quantity 2 → 2 tickets)', async () => {
    await applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })

    expect(tx.ticket.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ walkId: 'walk-1', orderId: 'order-1', userId: 'user-1' }),
        ]),
      })
    )
    const call = tx.ticket.createMany.mock.calls[0][0] as { data: unknown[] }
    expect(call.data).toHaveLength(2)
  })

  it('sends confirmation mail to the buyer email, not the userId', async () => {
    await applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    )
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'order-paid', to: 'buyer@example.com', data: { orderId: 'order-1' } })
    )
    expect(sendMailMock).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'user-1' }))
  })

  it('logs and does not throw when the buyer user record is not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })
    ).resolves.not.toThrow()

    expect(sendMailMock).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('is a no-op when order is already PAID (idempotent)', async () => {
    tx.order.findUnique.mockResolvedValue({ ...baseOrder, status: 'PAID', paidAt: new Date() })
    tx.ticket.count.mockResolvedValue(2)

    await applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })

    expect(tx.ticket.createMany).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('still marks PAID and creates tickets when order is EXPIRED (honour real payment)', async () => {
    tx.order.findUnique.mockResolvedValue({
      ...baseOrder,
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 60_000),
    })

    await applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) })
    )
    expect(tx.ticket.createMany).toHaveBeenCalled()
  })

  it('sets paymentIssue and does NOT mark PAID when amount mismatches', async () => {
    await applyPaymentResult({
      paymentId: 'pay-abc',
      status: 'succeeded',
      amountKopecks: 999, // wrong amount
    })

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentIssue: expect.any(String) }),
      })
    )
    const updateCall = tx.order.update.mock.calls[0][0] as { data: { status?: string } }
    expect(updateCall.data.status).not.toBe('PAID')
    expect(tx.ticket.createMany).not.toHaveBeenCalled()
  })
})

describe('applyPaymentResult — canceled', () => {
  it('transitions order to FAILED', async () => {
    await applyPaymentResult({ paymentId: 'pay-abc', status: 'canceled', amountKopecks: 0 })

    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    )
  })

  it('does not create tickets', async () => {
    await applyPaymentResult({ paymentId: 'pay-abc', status: 'canceled', amountKopecks: 0 })
    expect(tx.ticket.createMany).not.toHaveBeenCalled()
  })
})

describe('applyPaymentResult — pending', () => {
  it('makes no DB changes', async () => {
    await applyPaymentResult({ paymentId: 'pay-abc', status: 'pending', amountKopecks: 150000 })
    expect(tx.order.update).not.toHaveBeenCalled()
    expect(tx.ticket.createMany).not.toHaveBeenCalled()
  })
})

describe('applyPaymentResult — unknown payment', () => {
  it('returns without error when order not found by paymentId', async () => {
    tx.order.findUnique.mockResolvedValue(null)
    await expect(
      applyPaymentResult({ paymentId: 'unknown-pay', status: 'succeeded', amountKopecks: 150000 })
    ).resolves.not.toThrow()
  })
})

describe('applyPaymentResult — concurrent webhook idempotency (Bug 1 regression)', () => {
  it('acquires a FOR UPDATE lock on the order row before reading status', async () => {
    await applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })
    expect(tx.$executeRaw).toHaveBeenCalled()
  })

  it('does not create tickets when re-read after lock reveals PAID', async () => {
    // Simulates the second concurrent webhook: findOrder reads AWAITING_PAYMENT,
    // but by the time the FOR UPDATE lock is acquired the first webhook has
    // already committed → re-read returns PAID.
    tx.order.findUnique
      .mockResolvedValueOnce(baseOrder)              // findOrder: found by paymentId
      .mockResolvedValueOnce({ status: 'PAID' })     // re-read after lock

    await applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })

    expect(tx.ticket.createMany).not.toHaveBeenCalled()
  })

  it('does not send confirmation mail when re-read after lock reveals PAID', async () => {
    tx.order.findUnique
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce({ status: 'PAID' })

    await applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })

    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('does not update order status when re-read after lock reveals PAID', async () => {
    tx.order.findUnique
      .mockResolvedValueOnce(baseOrder)
      .mockResolvedValueOnce({ status: 'PAID' })

    await applyPaymentResult({ paymentId: 'pay-abc', status: 'succeeded', amountKopecks: 150000 })

    expect(tx.order.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) })
    )
  })
})
