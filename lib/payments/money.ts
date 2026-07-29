const KOPECKS_PER_RUBLE = 100

/**
 * Converts an integer kopecks amount into the two-decimal RUB string ЮKassa expects
 * (e.g. `150000` -> `"1500.00"`). Uses integer arithmetic only — never
 * `Number.toFixed` on the result of a floating-point division — so there is no
 * float drift anywhere in the money path.
 */
export function kopecksToString(kopecks: number): string {
  const rubles = Math.trunc(kopecks / KOPECKS_PER_RUBLE)
  const remainder = Math.abs(kopecks % KOPECKS_PER_RUBLE)
  const decimals = remainder.toString().padStart(2, '0')
  return `${rubles}.${decimals}`
}
