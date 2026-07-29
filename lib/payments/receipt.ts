import { kopecksToString } from '@/lib/payments/money'
import { YOOKASSA_DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import type { ReceiptInput, ReceiptItemInput } from '@/lib/payments/yookassa/types'

export interface ReceiptLineSource {
  description: string
  quantity: number
  unitPriceKopecks: number
}

export function truncateDescription(
  text: string,
  maxLength: number = YOOKASSA_DESCRIPTION_MAX_LENGTH
): string {
  return text.length <= maxLength ? text : text.slice(0, maxLength)
}

/**
 * Builds the 54-ФЗ receipt from OrderItem rows plus the buyer's account email.
 * `item.amount` is always the per-unit price; the caller-supplied `totalKopecks`
 * (the amount actually charged) must equal Σ(quantity × unitPriceKopecks) —
 * a mismatch throws rather than emitting a receipt ЮKassa would reject.
 */
export function buildReceipt(input: {
  customerEmail: string
  vatCode: string
  totalKopecks: number
  items: ReceiptLineSource[]
}): ReceiptInput {
  const items: ReceiptItemInput[] = input.items.map((item) => ({
    description: truncateDescription(item.description),
    quantity: item.quantity,
    unitPriceKopecks: item.unitPriceKopecks,
    vatCode: input.vatCode,
  }))

  const sumKopecks = items.reduce((sum, item) => sum + item.quantity * item.unitPriceKopecks, 0)
  if (sumKopecks !== input.totalKopecks) {
    throw new Error(
      `Receipt lines (${kopecksToString(sumKopecks)}) do not sum to the charged total (${kopecksToString(input.totalKopecks)})`
    )
  }

  return { customerEmail: input.customerEmail, items }
}
