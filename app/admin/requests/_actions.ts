'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth/permissions'
import type { RequestStatus } from '@/generated/prisma/client'

async function requireAdmin() {
  const session = await auth()
  if (!session || !isAdmin(session.user.role)) throw new Error('Недостаточно прав')
  return session
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<void> {
  await requireAdmin()
  await prisma.request.update({ where: { id }, data: { status } })
}
