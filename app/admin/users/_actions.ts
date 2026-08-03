'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/auth/permissions'
import type { Role } from '@/generated/prisma/client'

async function requireSuperAdmin() {
  const session = await auth()
  if (!session || !isSuperAdmin(session.user.role)) throw new Error('Недостаточно прав')
  return session
}

export async function changeUserRole(targetUserId: string, newRole: Role): Promise<void> {
  const session = await requireSuperAdmin()
  if (targetUserId === session.user.id) throw new Error('Нельзя изменить собственную роль')

  const target = await prisma.user.findFirst({ where: { id: targetUserId } })
  if (!target) throw new Error('Пользователь не найден')
  if (target.deletedAt != null) throw new Error('Нельзя изменить роль удалённого пользователя')

  // Guard: don't allow demoting last SUPERADMIN
  if (target.role === 'SUPERADMIN' && newRole !== 'SUPERADMIN') {
    const superAdminCount = await prisma.user.count({ where: { role: 'SUPERADMIN', deletedAt: null } })
    if (superAdminCount <= 1) throw new Error('Нельзя понизить последнего SUPERADMIN')
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: targetUserId }, data: { role: newRole } })
    await tx.roleChangeLog.create({
      data: {
        targetUserId,
        changedByUserId: session.user.id,
        fromRole: target.role,
        toRole: newRole,
      },
    })
  })
}

export async function blockUser(targetUserId: string): Promise<void> {
  const session = await requireSuperAdmin()
  if (targetUserId === session.user.id) throw new Error('Нельзя заблокировать себя')

  const target = await prisma.user.findFirst({ where: { id: targetUserId } })
  if (!target) throw new Error('Пользователь не найден')

  if (target.role === 'SUPERADMIN') {
    const nonBlockedCount = await prisma.user.count({
      where: { role: 'SUPERADMIN', blockedAt: null, deletedAt: null },
    })
    if (nonBlockedCount <= 1) throw new Error('Нельзя заблокировать последнего активного SUPERADMIN')
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { blockedAt: new Date() } })
}

export async function unblockUser(targetUserId: string): Promise<void> {
  await requireSuperAdmin()
  await prisma.user.update({ where: { id: targetUserId }, data: { blockedAt: null } })
}
