import { prisma } from '@/lib/prisma'
import { EventForm } from '@/components/admin/EventForm'

export default async function NewEventPage() {
  const guides = await prisma.teamMember.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Создать событие</h1>
      <EventForm guides={guides} />
    </div>
  )
}