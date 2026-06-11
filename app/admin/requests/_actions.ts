'use server'

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { prisma } from '@/lib/prisma'
import { RequestStatus } from '@/generated/prisma/client'
import { revalidatePath } from 'next/cache'

export async function updateRequestStatus(id: string, newStatus: RequestStatus): Promise<void> {
  await requireAdmin()
  if (!Object.values(RequestStatus).includes(newStatus)) throw new Error('Invalid status')
  await prisma.request.update({ where: { id }, data: { status: newStatus } })
  revalidatePath('/admin/requests')
}
