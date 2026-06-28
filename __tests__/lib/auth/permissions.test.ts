import { describe, it, expect } from 'vitest'
import { isAdmin, isSuperAdmin } from '@/lib/auth/permissions'

describe('isAdmin', () => {
  it('returns true for ADMIN', () => {
    expect(isAdmin('ADMIN')).toBe(true)
  })

  it('returns true for SUPERADMIN', () => {
    expect(isAdmin('SUPERADMIN')).toBe(true)
  })

  it('returns false for USER', () => {
    expect(isAdmin('USER')).toBe(false)
  })
})

describe('isSuperAdmin', () => {
  it('returns true for SUPERADMIN', () => {
    expect(isSuperAdmin('SUPERADMIN')).toBe(true)
  })

  it('returns false for ADMIN', () => {
    expect(isSuperAdmin('ADMIN')).toBe(false)
  })

  it('returns false for USER', () => {
    expect(isSuperAdmin('USER')).toBe(false)
  })
})