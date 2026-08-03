import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { updateTeamMember, deleteTeamMember } from '@/app/admin/team/_actions'

export default async function EditTeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const memberId = parseInt(id, 10)
  const member = await prisma.teamMember.findFirst({ where: { id: memberId } })
  if (!member) notFound()

  async function handleUpdate(formData: FormData) {
    'use server'
    const profileLinks = (formData.get('profileLinks') as string)
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
    await updateTeamMember(memberId, {
      name: formData.get('name') as string,
      photoUrl: formData.get('photoUrl') as string,
      education: (formData.get('education') as string) || undefined,
      achievements: (formData.get('achievements') as string) || undefined,
      profileLinks,
      sortOrder: parseInt(formData.get('sortOrder') as string, 10),
    })
    redirect(`/admin/team/${memberId}`)
  }

  async function handleDelete() {
    'use server'
    await deleteTeamMember(memberId)
    redirect('/admin/team')
  }

  return (
    <div>
      <h1>{member.name}</h1>
      <Link href="/admin/team">← Назад</Link>

      <form action={handleDelete} style={{ display: 'inline' }}>
        <button type="submit">Удалить</button>
      </form>

      <form action={handleUpdate}>
        <label>
          Имя
          <input name="name" defaultValue={member.name} required />
        </label>
        <label>
          Фото (URL)
          <input name="photoUrl" type="url" defaultValue={member.photoUrl} required />
        </label>
        <label>
          Образование
          <textarea name="education" defaultValue={member.education ?? ''} />
        </label>
        <label>
          Достижения
          <textarea name="achievements" defaultValue={member.achievements ?? ''} />
        </label>
        <label>
          Ссылки профиля (по одной на строку)
          <textarea name="profileLinks" rows={3} defaultValue={member.profileLinks.join('\n')} />
        </label>
        <label>
          Порядок сортировки
          <input name="sortOrder" type="number" defaultValue={member.sortOrder} required />
        </label>
        <button type="submit">Сохранить</button>
      </form>
    </div>
  )
}
