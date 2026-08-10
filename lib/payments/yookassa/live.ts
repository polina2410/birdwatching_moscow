import axios from 'axios'
import { env } from '@/lib/env'
import { HTTP_STATUS_TOO_MANY_REQUESTS, HTTP_STATUS_INTERNAL_SERVER_ERROR } from '@/lib/constants'
import { kopecksToString } from '@/lib/payments/money'
import type { PaymentInput, PaymentResult, YooKassaClient, YooKassaPaymentResponse } from './types'

const YOOKASSA_TIMEOUT_MS = 10_000
const RETRYABLE_STATUS_THRESHOLD = HTTP_STATUS_INTERNAL_SERVER_ERROR

const yooKassaHttp = axios.create({
  baseURL: env.YOOKASSA_API_URL,
  auth: {
    username: env.YOOKASSA_SHOP_ID ?? '',
    password: env.YOOKASSA_SECRET_KEY ?? '',
  },
  timeout: YOOKASSA_TIMEOUT_MS,
  validateStatus: () => true,
})

function isRetryableStatus(status: number): boolean {
  return status === HTTP_STATUS_TOO_MANY_REQUESTS || status >= RETRYABLE_STATUS_THRESHOLD
}

function providerError(action: string, status: number): Error {
  return Object.assign(new Error(`ЮKassa ${action} failed with status ${status}`), {
    code: isRetryableStatus(status) ? 'PROVIDER_5XX' : 'PROVIDER_4XX',
    status,
  })
}

function buildPayload(input: PaymentInput) {
  return {
    amount: input.amount,
    capture: input.capture,
    confirmation: input.confirmation,
    description: input.description,
    metadata: input.metadata,
    ...(input.receipt
      ? {
          receipt: {
            customer: { email: input.receipt.customerEmail },
            items: input.receipt.items.map((item) => ({
              description: item.description,
              quantity: item.quantity.toFixed(2),
              amount: { value: kopecksToString(item.unitPriceKopecks), currency: 'RUB' },
              vat_code: item.vatCode,
              payment_subject: 'service',
              payment_mode: 'full_payment',
            })),
          },
        }
      : {}),
  }
}

function toPaymentResult(data: YooKassaPaymentResponse): PaymentResult {
  return {
    id: data.id,
    status: data.status,
    confirmationUrl: data.confirmation?.confirmation_url ?? '',
  }
}

async function createPayment(input: PaymentInput): Promise<PaymentResult> {
  const response = await yooKassaHttp.post<YooKassaPaymentResponse>('/payments', buildPayload(input), {
    headers: { 'Idempotence-Key': input.idempotenceKey },
  })

  if (response.status < 200 || response.status >= 300) {
    throw providerError('create payment', response.status)
  }
  return toPaymentResult(response.data)
}

async function getPayment(paymentId: string): Promise<PaymentResult> {
  const response = await yooKassaHttp.get<YooKassaPaymentResponse>(`/payments/${paymentId}`)

  if (response.status < 200 || response.status >= 300) {
    throw providerError('get payment', response.status)
  }
  return toPaymentResult(response.data)
}

export const liveClient: YooKassaClient = { createPayment, getPayment }
