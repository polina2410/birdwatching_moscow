'use server'

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { prisma } from '@/lib/prisma'
import { teamMemberSchema, type TeamMemberInput } from '@/lib/validation/admin'
import { revalidatePath } from 'next/cache'

export async function createTeamMember(input: TeamMemberInput): Promise<string> {
  await requireAdmin()
  const parsed = teamMemberSchema.safeParse(input)
  if (!parsed.success) throw new Error('Validation failed')
  const { data } = parsed
  const member = await prisma.teamMember.create({ data })
  revalidatePath('/admin/team')
  return member.id
}

export async function updateTeamMember(id: string, input: TeamMemberInput): Promise<void> {
  await requireAdmin()
  const parsed = teamMemberSchema.safeParse(input)
  if (!parsed.success) throw new Error('Validation failed')
  await prisma.teamMember.update({ where: { id }, data: parsed.data })
  revalidatePath('/admin/team')
  revalidatePath(`/admin/team/${id}`)
}

export async function deleteTeamMember(id: string): Promise<void> {
  await requireAdmin()
  const member = await prisma.teamMember.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { events: true } } },
  })
  if (member._count.events > 0) {
    throw new Error(`Этот участник назначен гидом на ${member._count.events} событий. Сначала снимите его с событий.`)
  }
  await prisma.teamMember.delete({ where: { id } })
  revalidatePath('/admin/team')
}
