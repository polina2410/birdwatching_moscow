// NOTE: no HTTP client import — the stub makes zero network calls, so tests can
// assert the real (axios) client is never touched while YOOKASSA_MODE=stub.
import { randomUUID } from 'crypto'
import { env } from '@/lib/env'
import type { PaymentInput, PaymentResult, YooKassaClient } from './types'

function confirmationUrlFor(paymentId: string): string {
  return `${env.APP_URL}/dev/yookassa/${paymentId}`
}

async function createPayment(input: PaymentInput): Promise<PaymentResult> {
  const id = `stub_${randomUUID()}`

  // Carry orderId/amount through as query params so the dev confirmation page
  // can build a realistic, amount-matching notification without a lookup —
  // the stub itself persists nothing outside the Order.
  const url = new URL(confirmationUrlFor(id))
  url.searchParams.set('orderId', input.metadata.orderId)
  url.searchParams.set('amount', input.amount.value)

  return {
    id,
    status: 'pending',
    confirmationUrl: url.toString(),
  }
}

async function getPayment(paymentId: string): Promise<PaymentResult> {
  // Stub persists nothing outside the Order itself — the dev confirmation page
  // drives state transitions through the real webhook endpoint instead.
  return {
    id: paymentId,
    status: 'pending',
    confirmationUrl: confirmationUrlFor(paymentId),
  }
}

export const stubClient: YooKassaClient = { createPayment, getPayment }
