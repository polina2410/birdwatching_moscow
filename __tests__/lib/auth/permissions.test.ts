import { describe, it, expect } from 'vitest'
import { Role } from '@/generated/prisma/client'
import { isAdmin, isSuperAdmin } from '@/lib/auth/permissions'

describe('isAdmin', () => {
  it('returns true for ADMIN', () => {
    expect(isAdmin(Role.ADMIN)).toBe(true)
  })

  it('returns true for SUPERADMIN', () => {
    expect(isAdmin(Role.SUPERADMIN)).toBe(true)
  })

  it('returns false for USER', () => {
    expect(isAdmin(Role.USER)).toBe(false)
  })
})

describe('isSuperAdmin', () => {
  it('returns true for SUPERADMIN', () => {
    expect(isSuperAdmin(Role.SUPERADMIN)).toBe(true)
  })

  it('returns false for ADMIN', () => {
    expect(isSuperAdmin(Role.ADMIN)).toBe(false)
  })

  it('returns false for USER', () => {
    expect(isSuperAdmin(Role.USER)).toBe(false)
  })
})