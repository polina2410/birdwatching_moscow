import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { EventsTable } from '@/components/admin/EventsTable'
import { buttonVariants } from '@/components/ui/button'
import type { EventStatus, EventType } from '@/generated/prisma/client'

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string; status?: string; type?: string; search?: string }>
}

export default async function AdminEventsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))
  const status = params.status as EventStatus | undefined
  const type = params.type as EventType | undefined
  const search = params.search?.trim() ?? ''

  const where = {
    status: { not: 'DELETED' as EventStatus, ...(status ? { equals: status } : {}) },
    ...(type ? { type } : {}),
    ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { tickets: true } },
      },
    }),
    prisma.event.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">События</h1>
        <Link href="/admin/events/new" className={buttonVariants()}>Создать событие</Link>
      </div>
      <EventsTable events={events} page={page} totalPages={totalPages} />
    </div>
  )
}