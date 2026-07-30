import { describe, it, expect } from 'vitest'
import { truncateDescription, buildReceipt } from '@/lib/payments/receipt'
import { YOOKASSA_DESCRIPTION_MAX_LENGTH } from '@/lib/constants'

describe('truncateDescription', () => {
  it('returns the string unchanged when at or below the limit', () => {
    const text = 'A'.repeat(YOOKASSA_DESCRIPTION_MAX_LENGTH)
    expect(truncateDescription(text)).toBe(text)
  })

  it('slices to exactly maxLength when the string exceeds the limit', () => {
    const text = 'B'.repeat(YOOKASSA_DESCRIPTION_MAX_LENGTH + 10)
    const result = truncateDescription(text)
    expect(result).toHaveLength(YOOKASSA_DESCRIPTION_MAX_LENGTH)
    expect(result).toBe(text.slice(0, YOOKASSA_DESCRIPTION_MAX_LENGTH))
  })

  it('boundary: string of length maxLength + 1 is sliced by exactly one char', () => {
    const text = 'C'.repeat(YOOKASSA_DESCRIPTION_MAX_LENGTH + 1)
    expect(truncateDescription(text)).toHaveLength(YOOKASSA_DESCRIPTION_MAX_LENGTH)
  })

  it('respects a custom maxLength parameter', () => {
    expect(truncateDescription('hello world', 5)).toBe('hello')
    expect(truncateDescription('hi', 5)).toBe('hi')
  })

  it('returns empty string unchanged', () => {
    expect(truncateDescription('')).toBe('')
  })
})

describe('buildReceipt', () => {
  const base = {
    customerEmail: 'buyer@test.com',
    vatCode: '1',
    totalKopecks: 150000,
    items: [{ description: 'Лесная прогулка', quantity: 2, unitPriceKopecks: 75000 }],
  }

  it('returns a receipt with the correct customer email', () => {
    const receipt = buildReceipt(base)
    expect(receipt.customerEmail).toBe('buyer@test.com')
  })

  it('maps items with quantity, unitPriceKopecks and vatCode', () => {
    const receipt = buildReceipt(base)
    expect(receipt.items).toHaveLength(1)
    expect(receipt.items[0]).toMatchObject({
      quantity: 2,
      unitPriceKopecks: 75000,
      vatCode: '1',
    })
  })

  it('truncates item descriptions that exceed the max length', () => {
    const longDescription = 'D'.repeat(YOOKASSA_DESCRIPTION_MAX_LENGTH + 5)
    const receipt = buildReceipt({ ...base, items: [{ description: longDescription, quantity: 1, unitPriceKopecks: 150000 }] })
    expect(receipt.items[0].description.length).toBeLessThanOrEqual(YOOKASSA_DESCRIPTION_MAX_LENGTH)
  })

  it('handles multi-item orders where totals accumulate correctly', () => {
    const receipt = buildReceipt({
      customerEmail: 'a@b.com',
      vatCode: '2',
      totalKopecks: 200000,
      items: [
        { description: 'Прогулка 1', quantity: 1, unitPriceKopecks: 75000 },
        { description: 'Прогулка 2', quantity: 1, unitPriceKopecks: 125000 },
      ],
    })
    expect(receipt.items).toHaveLength(2)
  })

  it('throws when line item sum does not equal totalKopecks', () => {
    expect(() =>
      buildReceipt({ ...base, totalKopecks: 99999 })
    ).toThrow()
  })

  it('error message includes both the computed sum and the expected total', () => {
    expect(() =>
      buildReceipt({ ...base, totalKopecks: 99999 })
    ).toThrow(/1500\.00.*999\.99|999\.99.*1500\.00/)
  })
})
