import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { notFound } from 'next/navigation'
import { EventForm } from '@/components/admin/EventForm'
import Link from 'next/link'

type Props = { params: Promise<{ id: string }> }

export default async function EditEventPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const [event, guides, requestCount] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: { days: { orderBy: { dayNumber: 'asc' } }, guides: { select: { id: true } }, _count: { select: { tickets: true } } },
    }),
    prisma.teamMember.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
    prisma.request.count({ where: { eventId: id } }),
  ])

  if (!event) notFound()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Редактировать событие</h1>
        {event.type === 'EXPEDITION' && requestCount > 0 && (
          <Link
            href={`/admin/requests?eventId=${event.id}`}
            className="text-sm text-primary hover:underline"
          >
            Заявки на это событие ({requestCount})
          </Link>
        )}
      </div>
      <EventForm event={event} guides={guides} />
    </div>
  )
}