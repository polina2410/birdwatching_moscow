import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { createPayment } from '@/lib/payments/yookassa'
import { kopecksToString } from '@/lib/payments/money'
import { buildReceipt, truncateDescription } from '@/lib/payments/receipt'
import { env } from '@/lib/env'
import { validateRequest } from '@/lib/api/validate'
import {
  PAYMENT_HOLD_MINUTES,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  HTTP_STATUS_BAD_GATEWAY,
} from '@/lib/constants'
import type { Prisma } from '@/generated/prisma/client'
import type { CheckoutErrorCode, WalkSnapshot, CreatedOrder, OrderLineItem } from '@/types/checkout'

const MS_PER_MINUTE = 60 * 1000

const checkoutBodySchema = z.object({
  walkId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
})

// NOTE: dynamic import so module resolution is deferred until the handler runs —
// required for the mocked '@/lib/prisma' module to resolve correctly in tests.
async function getPrisma() {
  return (await import('@/lib/prisma')).prisma
}

class CheckoutError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    public readonly status: number
  ) {
    super(code)
  }
}

async function createPendingOrder(
  userId: string,
  walkId: string,
  quantity: number
): Promise<{ order: CreatedOrder; lineItems: OrderLineItem[] }> {
  const prisma = await getPrisma()
  return prisma.$transaction(async (tx) => {
    const now = new Date()

    // Lock walk row before reading to prevent double-booking under concurrent checkouts.
    await tx.$executeRaw`SELECT id FROM "Walk" WHERE id = ${walkId} FOR UPDATE`

    const [walk] = (await tx.walk.findMany({ where: { id: walkId } })) as WalkSnapshot[]

    const [soldCount, activeOrderItems] = await Promise.all([
      tx.ticket.count({ where: { walkId } }),
      tx.orderItem.findMany({
        where: { walkId, order: { status: 'AWAITING_PAYMENT', expiresAt: { gt: now } } },
      }),
    ])

    const orderSeats = activeOrderItems.reduce((sum, item) => sum + item.quantity, 0)
    if (soldCount + orderSeats + quantity > walk.capacity) {
      throw new CheckoutError('CAPACITY_EXCEEDED', HTTP_STATUS_CONFLICT)
    }

    const totalKopecks = walk.priceKopecks * quantity
    const expiresAt = new Date(now.getTime() + PAYMENT_HOLD_MINUTES * MS_PER_MINUTE)

    const order = await tx.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalKopecks,
        expiresAt,
        orderItems: {
          create: [{ walkId, quantity, unitPriceKopecks: walk.priceKopecks }],
        },
      } satisfies Prisma.OrderUncheckedCreateInput,
    })

    const lineItems: OrderLineItem[] = [
      {
        walkId,
        title: walk.title,
        quantity,
        unitPriceKopecks: walk.priceKopecks,
      },
    ]

    return { order: order as CreatedOrder, lineItems }
  })
}

async function markAwaitingPayment(orderId: string, paymentId: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'AWAITING_PAYMENT', yooKassaPaymentId: paymentId },
    })
  })
}

function buildDescription(orderId: string, lineItems: OrderLineItem[]): string {
  const shortId = orderId.slice(0, 8)
  const titles = [...new Set(lineItems.map((item) => item.title))].join(', ')
  return truncateDescription(`Заказ ${shortId}: ${titles}`)
}

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS_UNAUTHORIZED })
  }

  const rateLimit = await checkRateLimit(userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: HTTP_STATUS_TOO_MANY_REQUESTS, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    )
  }

  const parsed = await validateRequest(req, checkoutBodySchema)
  if (!parsed.success) return parsed.response

  const { walkId, quantity } = parsed.data

  let order: CreatedOrder
  let lineItems: OrderLineItem[]
  try {
    ;({ order, lineItems } = await createPendingOrder(userId, walkId, quantity))
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ code: error.code }, { status: error.status })
    }
    throw error
  }

  try {
    const buyerEmail = session.user.email ?? ''
    const receipt = env.YOOKASSA_RECEIPT_ENABLED
      ? buildReceipt({
          customerEmail: buyerEmail,
          vatCode: env.YOOKASSA_VAT_CODE ?? '',
          totalKopecks: order.totalKopecks,
          items: lineItems.map((item) => ({
            description: item.title,
            quantity: item.quantity,
            unitPriceKopecks: item.unitPriceKopecks,
          })),
        })
      : undefined

    const paymentResult = await createPayment({
      idempotenceKey: order.id,
      amount: { value: kopecksToString(order.totalKopecks), currency: 'RUB' },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: `${env.APP_URL}/checkout/return?orderId=${order.id}`,
      },
      description: buildDescription(order.id, lineItems),
      metadata: { orderId: order.id },
      receipt,
    })

    await markAwaitingPayment(order.id, paymentResult.id)

    return NextResponse.json({ orderId: order.id, confirmationUrl: paymentResult.confirmationUrl })
  } catch (error) {
    console.error('[checkout] ЮKassa create payment failed', error)
    return NextResponse.json({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' }, { status: HTTP_STATUS_BAD_GATEWAY })
  }
}
