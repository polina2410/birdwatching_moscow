import { describe, it, expect } from 'vitest'
import { Prisma } from '@/generated/prisma/client'

// These tests are RED until:
//   1. OrderItem model and Order field additions are added to prisma/schema.prisma
//   2. `prisma generate` is re-run

describe('OrderItem model', () => {
  it('OrderItem is a registered Prisma model', () => {
    expect((Prisma.ModelName as Record<string, unknown>).OrderItem).toBe('OrderItem')
  })

  const OrderItem = (Prisma as Record<string, unknown>).OrderItemScalarFieldEnum as
    | Record<string, unknown>
    | undefined

  it('OrderItemScalarFieldEnum exists', () => {
    expect(OrderItem).toBeDefined()
  })

  it('OrderItem has orderId FK', () => {
    expect(OrderItem?.orderId).toBe('orderId')
  })

  it('OrderItem has walkId FK', () => {
    expect(OrderItem?.walkId).toBe('walkId')
  })

  it('OrderItem has quantity', () => {
    expect(OrderItem?.quantity).toBe('quantity')
  })

  it('OrderItem has unitPriceKopecks', () => {
    expect(OrderItem?.unitPriceKopecks).toBe('unitPriceKopecks')
  })
})

describe('Order schema additions', () => {
  const Order = (Prisma as Record<string, unknown>).OrderScalarFieldEnum as
    | Record<string, unknown>
    | undefined

  it('Order has expiresAt', () => {
    expect(Order?.expiresAt).toBe('expiresAt')
  })

  it('Order has paidAt', () => {
    expect(Order?.paidAt).toBe('paidAt')
  })

  it('Order has paymentIssue', () => {
    expect(Order?.paymentIssue).toBe('paymentIssue')
  })
})
