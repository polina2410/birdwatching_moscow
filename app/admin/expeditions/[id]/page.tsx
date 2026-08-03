import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { updateExpedition, publishExpedition, cancelExpedition, deleteExpedition } from '@/app/admin/expeditions/_actions'

export default async function EditExpeditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [expedition, guides] = await Promise.all([
    prisma.expedition.findFirst({
      where: { id, status: { not: 'DELETED' } },
      include: { guides: { select: { id: true } }, days: { orderBy: { dayNumber: 'asc' } } },
    }),
    prisma.teamMember.findMany({ orderBy: { name: 'asc' } }),
  ])
  if (!expedition) notFound()

  const expeditionDays = expedition.days

  async function handleUpdate(formData: FormData) {
    'use server'
    const guideIds = formData.getAll('guideIds') as string[]
    const galleryUrls = (formData.get('galleryUrls') as string)
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    await updateExpedition(id, {
      type: 'EXPEDITION',
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      startsAt: formData.get('startsAt') as string,
      endsAt: (formData.get('endsAt') as string) || undefined,
      location: formData.get('location') as string,
      coverPhotoUrl: formData.get('coverPhotoUrl') as string,
      galleryUrls,
      totalSpots: parseInt(formData.get('totalSpots') as string, 10),
      spotsLeft: parseInt(formData.get('spotsLeft') as string, 10),
      guideIds,
      days: expeditionDays.map((d) => ({
        clientId: d.id,
        dayNumber: d.dayNumber,
        title: d.title,
        description: d.description,
      })),
    })
    redirect(`/admin/expeditions/${id}`)
  }

  async function handlePublish() {
    'use server'
    await publishExpedition(id)
    redirect(`/admin/expeditions/${id}`)
  }

  async function handleCancel() {
    'use server'
    await cancelExpedition(id)
    redirect(`/admin/expeditions/${id}`)
  }

  async function handleDelete() {
    'use server'
    await deleteExpedition(id)
    redirect('/admin/expeditions')
  }

  const currentGuideIds = new Set(expedition.guides.map((g) => String(g.id)))
  const startsAtLocal = expedition.startsAt.toISOString().slice(0, 16)
  const endsAtLocal = expedition.endsAt?.toISOString().slice(0, 16) ?? ''

  return (
    <div>
      <h1>{expedition.title}</h1>
      <Link href="/admin/expeditions">← Назад</Link>
      <p>Статус: {expedition.status}</p>

      <div>
        {expedition.status === 'DRAFT' && (
          <form action={handlePublish} style={{ display: 'inline' }}>
            <button type="submit">Опубликовать</button>
          </form>
        )}
        {expedition.status === 'ACTIVE' && (
          <form action={handleCancel} style={{ display: 'inline' }}>
            <button type="submit">Отменить</button>
          </form>
        )}
        <form action={handleDelete} style={{ display: 'inline' }}>
          <button type="submit">Удалить</button>
        </form>
      </div>

      <form action={handleUpdate}>
        <label>
          Название
          <input name="title" defaultValue={expedition.title} required />
        </label>
        <label>
          Описание
          <textarea name="description" defaultValue={expedition.description} required />
        </label>
        <label>
          Начало
          <input name="startsAt" type="datetime-local" defaultValue={startsAtLocal} required />
        </label>
        <label>
          Конец
          <input name="endsAt" type="datetime-local" defaultValue={endsAtLocal} />
        </label>
        <label>
          Место
          <input name="location" defaultValue={expedition.location} required />
        </label>
        <label>
          Обложка (URL)
          <input name="coverPhotoUrl" type="url" defaultValue={expedition.coverPhotoUrl} required />
        </label>
        <label>
          Галерея (URL, по одному на строку, макс. 5)
          <textarea name="galleryUrls" rows={5} defaultValue={expedition.galleryUrls.join('\n')} />
        </label>
        <label>
          Мест всего
          <input name="totalSpots" type="number" min="1" defaultValue={expedition.totalSpots} required />
        </label>
        <label>
          Мест осталось
          <input name="spotsLeft" type="number" min="0" defaultValue={expedition.spotsLeft} required />
        </label>
        <label>
          Гиды
          <select name="guideIds" multiple>
            {guides.map((g) => (
              <option key={g.id} value={String(g.id)} selected={currentGuideIds.has(String(g.id))}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Сохранить</button>
      </form>
    </div>
  )
}
