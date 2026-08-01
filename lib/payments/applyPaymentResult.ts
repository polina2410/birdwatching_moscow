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
  await prisma.$transaction(async (tx) => {
    const order = await findOrder(tx, input)
    if (!order) return

    if (input.status === 'pending') return
    if (input.status === 'canceled') {
      await handleCanceled(tx, order)
      return
    }
    await handleSucceeded(tx, order, input.amountKopecks)
  })
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
): Promise<void> {
  if (order.status === 'PAID') return // idempotent — already settled, never re-issue tickets

  if (amountKopecks !== order.totalKopecks) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentIssue: `Amount mismatch: expected ${order.totalKopecks} kopecks, received ${amountKopecks} kopecks`,
      },
    })
    return
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

  // NOTE: `to` should be the buyer's account email; resolving it needs a User lookup
  // that isn't wired up yet. lib/mail.ts is still a stub (out of scope per spec), so
  // the exact value doesn't affect delivery today.
  await sendMail({ kind: 'order-paid', to: order.userId, data: { orderId: order.id } })
}
