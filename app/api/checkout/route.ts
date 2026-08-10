import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { createPayment } from '@/lib/payments/yookassa'
import { kopecksToString } from '@/lib/payments/money'
import { buildReceipt, truncateDescription } from '@/lib/payments/receipt'
import { env } from '@/lib/env'
import { PAYMENT_HOLD_MINUTES, HTTP_STATUS_CONFLICT, HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_TOO_MANY_REQUESTS, HTTP_STATUS_BAD_GATEWAY } from '@/lib/constants'
import type { Prisma } from '@/generated/prisma/client'
import type { CheckoutErrorCode, WalkSnapshot, CreatedOrder, OrderLineItem } from '@/types/checkout'

const MS_PER_MINUTE = 60 * 1000

// NOTE: dynamic import (not a static top-level import) so module resolution is
// deferred until the handler actually runs, well after this module's own
// top-level code — required for the mocked '@/lib/prisma' module to resolve
// correctly in tests.
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
  userId: string
): Promise<{ order: CreatedOrder; lineItems: OrderLineItem[] }> {
  const prisma = await getPrisma()
  return prisma.$transaction(async (tx) => {
    const now = new Date()

    const cartItems = await tx.cartItem.findMany({ where: { userId } })
    if (cartItems.length === 0) {
      throw new CheckoutError('CART_EMPTY', HTTP_STATUS_CONFLICT)
    }

    const activeCartItems = cartItems.filter((item) => item.reservedUntil > now)
    if (activeCartItems.length === 0) {
      throw new CheckoutError('CART_EXPIRED', HTTP_STATUS_CONFLICT)
    }

    const walkIds = [...new Set(activeCartItems.map((item) => item.walkId))]

    // Lock walk rows in sorted order (prevents deadlocks) so concurrent checkouts
    // for the same walk queue here and the second sees the first's OrderItems.
    for (const walkId of [...walkIds].sort()) {
      await tx.$executeRaw`SELECT id FROM "Walk" WHERE id = ${walkId} FOR UPDATE`
    }

    const walks = (await tx.walk.findMany({
      where: { id: { in: walkIds } },
    })) as WalkSnapshot[]
    const walkById = new Map(walks.map((walk) => [walk.id, walk]))

    for (const walkId of walkIds) {
      const walk = walkById.get(walkId)
      if (!walk) continue

      const [soldCount, activeCartSeats, activeOrderItems] = await Promise.all([
        tx.ticket.count({ where: { walkId } }),
        tx.cartItem.findMany({ where: { walkId, reservedUntil: { gt: now } } }),
        tx.orderItem.findMany({
          where: { walkId, order: { status: 'AWAITING_PAYMENT', expiresAt: { gt: now } } },
        }),
      ])

      const cartSeats = activeCartSeats.reduce((sum, item) => sum + item.quantity, 0)
      const orderSeats = activeOrderItems.reduce((sum, item) => sum + item.quantity, 0)
      const seatsTaken = soldCount + cartSeats + orderSeats

      if (seatsTaken > walk.capacity) {
        throw new CheckoutError('CAPACITY_EXCEEDED', HTTP_STATUS_CONFLICT)
      }
    }

    // Total is computed from the DB — the request body carries no prices or quantities.
    const totalKopecks = activeCartItems.reduce((sum, item) => {
      const walk = walkById.get(item.walkId)
      return sum + (walk ? walk.priceKopecks * item.quantity : 0)
    }, 0)

    const expiresAt = new Date(now.getTime() + PAYMENT_HOLD_MINUTES * MS_PER_MINUTE)

    const order = await tx.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalKopecks,
        expiresAt,
        orderItems: {
          create: activeCartItems.map((item) => ({
            walkId: item.walkId,
            quantity: item.quantity,
            unitPriceKopecks: walkById.get(item.walkId)?.priceKopecks ?? 0,
          })),
        },
      } satisfies Prisma.OrderUncheckedCreateInput,
    })

    await tx.cartItem.deleteMany({ where: { userId } })

    const lineItems: OrderLineItem[] = activeCartItems.map((item) => {
      const walk = walkById.get(item.walkId)
      return {
        walkId: item.walkId,
        title: walk?.title ?? '',
        quantity: item.quantity,
        unitPriceKopecks: walk?.priceKopecks ?? 0,
      }
    })

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

  // The request body carries no prices/quantities and is intentionally ignored.
  await req.json().catch(() => null)

  let order: CreatedOrder
  let lineItems: OrderLineItem[]
  try {
    ;({ order, lineItems } = await createPendingOrder(userId))
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
    // Order stays PENDING with yooKassaPaymentId === null — nothing is silently
    // lost, and the client can retry checkout for the same (now empty) cart.
    console.error('[checkout] ЮKassa create payment failed', error)
    return NextResponse.json({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' }, { status: HTTP_STATUS_BAD_GATEWAY })
  }
}
