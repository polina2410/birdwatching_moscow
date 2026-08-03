import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createWalk } from '@/app/admin/walks/_actions'

export default async function NewWalkPage() {
  const guides = await prisma.teamMember.findMany({ orderBy: { name: 'asc' } })

  async function handleCreate(formData: FormData) {
    'use server'
    const id = await createWalk({
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

  return (
    <div>
      <h1>Новая прогулка</h1>
      <Link href="/admin/walks">← Назад</Link>
      <form action={handleCreate}>
        <label>
          Название
          <input name="title" required />
        </label>
        <label>
          Описание
          <textarea name="description" required />
        </label>
        <label>
          Дата и время
          <input name="startsAt" type="datetime-local" required />
        </label>
        <label>
          Продолжительность
          <input name="duration" placeholder="напр. 2 часа" />
        </label>
        <label>
          Место
          <input name="location" required />
        </label>
        <label>
          Обложка (URL)
          <input name="coverPhotoUrl" type="url" required />
        </label>
        <label>
          Фото галереи (URL)
          <input name="galleryUrl" type="url" />
        </label>
        <label>
          Цена (₽)
          <input name="priceRub" type="number" min="0" step="1" required />
        </label>
        <label>
          Мест
          <input name="capacity" type="number" min="1" required />
        </label>
        <label>
          Гид
          <select name="guideId" required>
            {guides.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <button type="submit">Создать</button>
      </form>
    </div>
  )
}
