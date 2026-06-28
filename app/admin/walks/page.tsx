import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import Link from 'next/link'
import { EventsTable } from '@/components/admin/EventsTable'
import { buttonVariants } from '@/components/ui/button'
import type { EventStatus } from '@/generated/prisma/client'

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>
}

export default async function AdminWalksPage({ searchParams }: Props) {
  await requireAdmin()
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))
  const status = params.status as EventStatus | undefined
  const search = params.search?.trim() ?? ''

  const where = {
    type: 'WALK' as const,
    status: { not: 'DELETED' as EventStatus, ...(status ? { equals: status } : {}) },
    ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { tickets: true } } },
    }),
    prisma.event.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Прогулки</h1>
        <Link href="/admin/events/new" className={buttonVariants()}>Создать прогулку</Link>
      </div>
      <EventsTable events={events} page={page} totalPages={totalPages} />
    </div>
  )
}
