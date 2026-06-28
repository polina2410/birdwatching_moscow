import { Role } from '@/generated/prisma/client'

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

export function isSuperAdmin(role: Role): boolean {
  return role === Role.SUPERADMIN
}
