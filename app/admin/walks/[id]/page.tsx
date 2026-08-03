import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { updateWalk, publishWalk, cancelWalk, deleteWalk } from '@/app/admin/walks/_actions'

export default async function EditWalkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [walk, guides] = await Promise.all([
    prisma.walk.findFirst({ where: { id, status: { not: 'DELETED' } } }),
    prisma.teamMember.findMany({ orderBy: { name: 'asc' } }),
  ])
  if (!walk) notFound()

  async function handleUpdate(formData: FormData) {
    'use server'
    await updateWalk(id, {
      type: 'WALK',
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      startsAt: formData.get('startsAt') as string,
      duration: (formData.get('duration') as string) || undefined,
      location: formData.get('location') as string,
      coverPhotoUrl: formData.get('coverPhotoUrl') as string,
      galleryUrl: (formData.get('galleryUrl') as string) || undefined,
      priceKopecks: Math.round(parseFloat(formData.get('priceRub') as string) * 100),
      capacity: parseInt(formData.get('capacity') as string, 10),
      guideId: parseInt(formData.get('guideId') as string, 10),
    })
    redirect(`/admin/walks/${id}`)
  }

  async function handlePublish() {
    'use server'
    await publishWalk(id)
    redirect(`/admin/walks/${id}`)
  }

  async function handleCancel() {
    'use server'
    await cancelWalk(id)
    redirect(`/admin/walks/${id}`)
  }

  async function handleDelete() {
    'use server'
    await deleteWalk(id)
    redirect('/admin/walks')
  }

  const startsAtLocal = walk.startsAt.toISOString().slice(0, 16)

  return (
    <div>
      <h1>{walk.title}</h1>
      <Link href="/admin/walks">← Назад</Link>
      <p>Статус: {walk.status}</p>

      <div>
        {walk.status === 'DRAFT' && (
          <form action={handlePublish} style={{ display: 'inline' }}>
            <button type="submit">Опубликовать</button>
          </form>
        )}
        {walk.status === 'ACTIVE' && (
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
          <input name="title" defaultValue={walk.title} required />
        </label>
        <label>
          Описание
          <textarea name="description" defaultValue={walk.description} required />
        </label>
        <label>
          Дата и время
          <input name="startsAt" type="datetime-local" defaultValue={startsAtLocal} required />
        </label>
        <label>
          Продолжительность
          <input name="duration" defaultValue={walk.duration ?? ''} />
        </label>
        <label>
          Место
          <input name="location" defaultValue={walk.location} required />
        </label>
        <label>
          Обложка (URL)
          <input name="coverPhotoUrl" type="url" defaultValue={walk.coverPhotoUrl} required />
        </label>
        <label>
          Фото галереи (URL)
          <input name="galleryUrl" type="url" defaultValue={walk.galleryUrl ?? ''} />
        </label>
        <label>
          Цена (₽)
          <input name="priceRub" type="number" min="0" step="1" defaultValue={walk.priceKopecks / 100} required />
        </label>
        <label>
          Мест
          <input name="capacity" type="number" min="1" defaultValue={walk.capacity} required />
        </label>
        <label>
          Гид
          <select name="guideId" defaultValue={walk.guideId} required>
            {guides.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <button type="submit">Сохранить</button>
      </form>
    </div>
  )
}
