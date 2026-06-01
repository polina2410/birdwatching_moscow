import { prisma } from '@/lib/prisma'
import { RequestsTable } from '@/components/admin/RequestsTable'
import type { RequestStatus, RequestType } from '@/generated/prisma/client'

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{
    page?: string
    status?: string
    type?: string
    eventId?: string
  }>
}

export default async function AdminRequestsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))
  const status = params.status as RequestStatus | undefined
  const type = params.type as RequestType | undefined
  const eventId = params.eventId

  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : eventId ? { type: 'EXPEDITION' as RequestType } : {}),
    ...(eventId ? { eventId } : {}),
  }

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        event: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.request.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Заявки</h1>
      <RequestsTable
        requests={requests}
        page={page}
        totalPages={totalPages}
        eventIdFilter={eventId}
      />
    </div>
  )
}