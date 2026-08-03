import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mail'
import type { Prisma, OrderStatus } from '@/generated/prisma/client'
import type { ProviderPaymentStatus } from '@/lib/payments/yookassa/types'

export type { ProviderPaymentStatus }

export interface ApplyPaymentResultInput {
  paymentId: string
  status: ProviderPaymentStatus
  amountKopecks: number
  orderId?: string
}

interface OrderRecord {
  id: string
  userId: string
  status: OrderStatus
  totalKopecks: number
}

/**
 * The single state machine both the webhook and the return-page reconciliation call.
 * Runs in a transaction, re-reads the order, and is a no-op if the order is already
 * in the target state — safe to call twice with the same notification.
 */
export async function applyPaymentResult(input: ApplyPaymentResultInput): Promise<void> {
  const paidOrder = await prisma.$transaction(async (tx) => {
    const order = await findOrder(tx, input)
    if (!order) return null

    if (input.status === 'pending') return null
    if (input.status === 'canceled') {
      await handleCanceled(tx, order)
      return null
    }
    return handleSucceeded(tx, order, input.amountKopecks)
  })

  if (paidOrder) {
    await sendOrderPaidMail(paidOrder.orderId, paidOrder.userId)
  }
}

// Runs after the transaction has committed — the DB lock is already released,
// so a slow or failing mail dispatch never extends it.
async function sendOrderPaidMail(orderId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })

  if (!user) {
    console.error('[mail] order-paid: user not found for userId', userId)
    return
  }

  await sendMail({ kind: 'order-paid', to: user.email, data: { orderId } })
}

async function findOrder(
  tx: Prisma.TransactionClient,
  input: ApplyPaymentResultInput
): Promise<OrderRecord | null> {
  const byPaymentId = await tx.order.findUnique({ where: { yooKassaPaymentId: input.paymentId } })
  if (byPaymentId) return byPaymentId as OrderRecord

  if (input.orderId) {
    const byOrderId = await tx.order.findUnique({ where: { id: input.orderId } })
    if (byOrderId) return byOrderId as OrderRecord
  }

  return null
}

async function handleCanceled(tx: Prisma.TransactionClient, order: OrderRecord): Promise<void> {
  if (order.status === 'FAILED') return // idempotent
  await tx.order.update({ where: { id: order.id }, data: { status: 'FAILED' } })
}

async function handleSucceeded(
  tx: Prisma.TransactionClient,
  order: OrderRecord,
  amountKopecks: number
): Promise<{ orderId: string; userId: string } | null> {
  // Pessimistic lock — concurrent webhook deliveries queue here; the second one
  // reads the PAID status committed by the first and exits without re-issuing tickets.
  await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`
  const fresh = await tx.order.findUnique({ where: { id: order.id }, select: { status: true } })
  if (!fresh || fresh.status === 'PAID') return null // idempotent — already settled

  if (amountKopecks !== order.totalKopecks) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentIssue: `Amount mismatch: expected ${order.totalKopecks} kopecks, received ${amountKopecks} kopecks`,
      },
    })
    return null
  }

  // Honour a successful payment even if our own hold expired — the customer's
  // money was taken, so the order settles regardless of AWAITING_PAYMENT/EXPIRED.
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'PAID', paidAt: new Date() },
  })

  const items = await tx.orderItem.findMany({ where: { orderId: order.id } })
  const ticketsData = items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      orderId: order.id,
      userId: order.userId,
      walkId: item.walkId,
    }))
  )

  if (ticketsData.length > 0) {
    await tx.ticket.createMany({ data: ticketsData })
  }

  return { orderId: order.id, userId: order.userId }
}
