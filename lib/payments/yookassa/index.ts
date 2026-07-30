import { env } from '@/lib/env'
import { liveClient } from './live'
import { stubClient } from './stub'
import type { PaymentInput, PaymentResult, YooKassaClient } from './types'

const client: YooKassaClient = env.YOOKASSA_MODE === 'live' ? liveClient : stubClient

export function createPayment(input: PaymentInput): Promise<PaymentResult> {
  return client.createPayment(input)
}

export function getPayment(paymentId: string): Promise<PaymentResult> {
  return client.getPayment(paymentId)
}

export type { PaymentInput, PaymentResult, YooKassaClient } from './types'
