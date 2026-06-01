import type { Role } from '@/generated/prisma/client'

export function isAdmin(role: Role): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

export function isSuperAdmin(role: Role): boolean {
  return role === 'SUPERADMIN'
}

export function canManageRoles(role: Role): boolean {
  return role === 'SUPERADMIN'
}