import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createExpedition } from '@/app/admin/expeditions/_actions'

export default async function NewExpeditionPage() {
  const guides = await prisma.teamMember.findMany({ orderBy: { name: 'asc' } })

  async function handleCreate(formData: FormData) {
    'use server'
    const guideIds = formData.getAll('guideIds') as string[]
    const galleryUrls = (formData.get('galleryUrls') as string)
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    const id = await createExpedition({
      type: 'EXPEDITION',
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      startsAt: formData.get('startsAt') as string,
      endsAt: (formData.get('endsAt') as string) || undefined,
      location: formData.get('location') as string,
      coverPhotoUrl: formData.get('coverPhotoUrl') as string,
      galleryUrls,
      totalSpots: parseInt(formData.get('totalSpots') as string, 10),
      spotsLeft: parseInt(formData.get('totalSpots') as string, 10),
      guideIds,
      days: [],
    })
    redirect(`/admin/expeditions/${id}`)
  }

  return (
    <div>
      <h1>Новая экспедиция</h1>
      <Link href="/admin/expeditions">← Назад</Link>
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
          Начало
          <input name="startsAt" type="datetime-local" required />
        </label>
        <label>
          Конец
          <input name="endsAt" type="datetime-local" />
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
          Галерея (URL, по одному на строку, макс. 5)
          <textarea name="galleryUrls" rows={5} />
        </label>
        <label>
          Мест всего
          <input name="totalSpots" type="number" min="1" required />
        </label>
        <label>
          Гиды
          <select name="guideIds" multiple>
            {guides.map((g) => (
              <option key={g.id} value={String(g.id)}>{g.name}</option>
            ))}
          </select>
        </label>
        <button type="submit">Создать</button>
      </form>
    </div>
  )
}
