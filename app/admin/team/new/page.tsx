import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createTeamMember } from '@/app/admin/team/_actions'

export default function NewTeamMemberPage() {
  async function handleCreate(formData: FormData) {
    'use server'
    const profileLinks = (formData.get('profileLinks') as string)
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    const id = await createTeamMember({
      name: formData.get('name') as string,
      photoUrl: formData.get('photoUrl') as string,
      education: (formData.get('education') as string) || undefined,
      achievements: (formData.get('achievements') as string) || undefined,
      profileLinks,
      sortOrder: parseInt(formData.get('sortOrder') as string, 10),
    })
    redirect(`/admin/team/${id}`)
  }

  return (
    <div>
      <h1>Новый участник команды</h1>
      <Link href="/admin/team">← Назад</Link>
      <form action={handleCreate}>
        <label>
          Имя
          <input name="name" required />
        </label>
        <label>
          Фото (URL)
          <input name="photoUrl" type="url" required />
        </label>
        <label>
          Образование
          <textarea name="education" />
        </label>
        <label>
          Достижения
          <textarea name="achievements" />
        </label>
        <label>
          Ссылки профиля (по одной на строку)
          <textarea name="profileLinks" rows={3} />
        </label>
        <label>
          Порядок сортировки
          <input name="sortOrder" type="number" defaultValue={0} required />
        </label>
        <button type="submit">Создать</button>
      </form>
    </div>
  )
}
