import { describe, it, expect } from 'vitest'
import { kopecksToString } from '@/lib/payments/money'

describe('kopecksToString', () => {
  it.each([
    [1, '0.01'],
    [99, '0.99'],
    [100, '1.00'],
    [150000, '1500.00'],
    [10, '0.10'],
    [1000, '10.00'],
  ])('converts %i kopecks → "%s"', (kopecks, expected) => {
    expect(kopecksToString(kopecks)).toBe(expected)
  })

  it('uses integer arithmetic — no float drift on awkward values', () => {
    expect(kopecksToString(3)).toBe('0.03')
    expect(kopecksToString(7)).toBe('0.07')
    expect(kopecksToString(33333)).toBe('333.33')
  })

  it('always returns exactly two decimal places', () => {
    const result = kopecksToString(100)
    const [, decimals] = result.split('.')
    expect(decimals).toHaveLength(2)
  })
})
