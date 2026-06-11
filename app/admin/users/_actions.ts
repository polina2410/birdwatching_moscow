'use server'

import { auth } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { Role } from '@/generated/prisma/client'
import { revalidatePath } from 'next/cache'

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user || !isSuperAdmin(session.user.role)) throw new Error('Forbidden')
  return session.user
}

export async function changeUserRole(targetUserId: string, newRole: Role): Promise<void> {
  const actor = await requireSuperAdmin()

  if (actor.id === targetUserId) throw new Error('Нельзя изменить собственную роль.')

  const target = await prisma.user.findUniqueOrThrow({
    where: { id: targetUserId },
    select: { role: true, deletedAt: true },
  })

  if (target.deletedAt) throw new Error('Нельзя изменить роль удалённого пользователя.')

  if (target.role === 'SUPERADMIN' && newRole !== 'SUPERADMIN') {
    const count = await prisma.user.count({ where: { role: 'SUPERADMIN', deletedAt: null } })
    if (count <= 1) throw new Error('Нельзя понизить последнего SUPERADMIN.')
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: targetUserId }, data: { role: newRole } }),
    prisma.roleChangeLog.create({
      data: {
        targetUserId,
        changedByUserId: actor.id,
        fromRole: target.role,
        toRole: newRole,
      },
    }),
  ])

  revalidatePath('/admin/users')
}

export async function blockUser(targetUserId: string): Promise<void> {
  const actor = await requireSuperAdmin()
  if (actor.id === targetUserId) throw new Error('Нельзя заблокировать себя.')

  const target = await prisma.user.findUniqueOrThrow({
    where: { id: targetUserId },
    select: { role: true },
  })

  if (target.role === 'SUPERADMIN') {
    const count = await prisma.user.count({ where: { role: 'SUPERADMIN', blockedAt: null, deletedAt: null } })
    if (count <= 1) throw new Error('Нельзя заблокировать последнего активного SUPERADMIN.')
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { blockedAt: new Date() } })
  revalidatePath('/admin/users')
}

export async function unblockUser(targetUserId: string): Promise<void> {
  await requireSuperAdmin()
  await prisma.user.update({ where: { id: targetUserId }, data: { blockedAt: null } })
  revalidatePath('/admin/users')
}

export async function getUserRoleHistory(targetUserId: string): Promise<{
  id: string
  fromRole: Role
  toRole: Role
  createdAt: Date
  changedByUser: { name: string; email: string }
}[]> {
  await requireSuperAdmin()
  return prisma.roleChangeLog.findMany({
    where: { targetUserId },
    orderBy: { createdAt: 'desc' },
    include: { changedByUser: { select: { name: true, email: true } } },
  })
}
