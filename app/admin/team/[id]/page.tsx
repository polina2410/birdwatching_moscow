import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { notFound } from 'next/navigation'
import { TeamMemberForm } from '@/components/admin/TeamMemberForm'

type Props = { params: Promise<{ id: string }> }

export default async function EditTeamMemberPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params
  const member = await prisma.teamMember.findUnique({ where: { id } })
  if (!member) notFound()
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Изменить участника команды</h1>
      <TeamMemberForm member={member} />
    </div>
  )
}
