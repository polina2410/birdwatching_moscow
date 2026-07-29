export type YooKassaPaymentStatus = 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'

export interface ReceiptItemInput {
  description: string
  quantity: number
  unitPriceKopecks: number
  vatCode: string
}

export interface ReceiptInput {
  customerEmail: string
  items: ReceiptItemInput[]
}

export interface PaymentInput {
  idempotenceKey: string
  amount: { value: string; currency: 'RUB' }
  capture: true
  confirmation: { type: 'redirect'; return_url: string }
  description: string
  metadata: { orderId: string }
  receipt?: ReceiptInput
}

export interface PaymentResult {
  id: string
  status: YooKassaPaymentStatus
  confirmationUrl: string
}

export interface YooKassaClient {
  createPayment(input: PaymentInput): Promise<PaymentResult>
  getPayment(paymentId: string): Promise<PaymentResult>
}
