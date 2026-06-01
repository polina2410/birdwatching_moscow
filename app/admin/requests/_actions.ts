'use server'

import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/auth/permissions'
import { prisma } from '@/lib/prisma'
import { RequestStatus } from '@/generated/prisma/client'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) throw new Error('Forbidden')
}

export async function updateRequestStatus(id: string, newStatus: RequestStatus): Promise<void> {
  await requireAdmin()
  if (!Object.values(RequestStatus).includes(newStatus)) throw new Error('Invalid status')
  await prisma.request.update({ where: { id }, data: { status: newStatus } })
  revalidatePath('/admin/requests')
}