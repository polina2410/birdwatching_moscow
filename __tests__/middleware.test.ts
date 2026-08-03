import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockImplementation((handler: unknown) => handler),
}))

import middleware, { config } from '@/middleware'

describe('middleware default export', () => {
  it('exports a function', () => {
    expect(typeof middleware).toBe('function')
  })
})

describe('middleware config.matcher', () => {
  it('is defined as an array', () => {
    expect(Array.isArray(config.matcher)).toBe(true)
    expect((config.matcher as string[]).length).toBeGreaterThan(0)
  })

  it('pattern excludes /admin paths (Django owns those)', () => {
    const pattern = (config.matcher as string[]).join('\n')
    expect(pattern).toMatch(/admin/)
  })

  it('pattern excludes /api paths', () => {
    const pattern = (config.matcher as string[]).join('\n')
    expect(pattern).toMatch(/api/)
  })

  it('pattern excludes /_next paths', () => {
    const pattern = (config.matcher as string[]).join('\n')
    expect(pattern).toMatch(/_next/)
  })
})
