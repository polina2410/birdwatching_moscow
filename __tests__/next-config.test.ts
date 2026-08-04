import { describe, it, expect } from 'vitest'
import nextConfig from '@/next.config'

describe('next.config', () => {
  it('has no rewrites configured', () => {
    expect(nextConfig.rewrites).toBeUndefined()
  })
})
