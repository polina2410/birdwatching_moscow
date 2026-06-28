import { Role } from '@/generated/prisma/enums'

export const ROLE_LABELS: Record<Role, string> = {
  [Role.USER]: 'Пользователь',
  [Role.ADMIN]: 'Админ',
  [Role.SUPERADMIN]: 'Суперадмин',
}

export const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[]
