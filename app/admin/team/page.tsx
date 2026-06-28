import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { TeamTable } from '@/components/admin/TeamTable'

export default async function AdminTeamPage() {
  await requireAdmin()
  const members = await prisma.teamMember.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { events: true } } },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Команда</h1>
        <Link href="/admin/team/new" className={buttonVariants({ variant: 'secondary' })}>Добавить участника</Link>
      </div>
      <TeamTable members={members} />
    </div>
  )
}
