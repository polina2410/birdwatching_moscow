import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function TeamPage() {
  const members = await prisma.teamMember.findMany({ orderBy: { sortOrder: 'asc' } })

  return (
    <div>
      <h1>Команда</h1>
      <Link href="/admin/team/new">Добавить участника</Link>
      <table>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Порядок</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td><a href={`/admin/team/${m.id}`}>{m.name}</a></td>
              <td>{m.sortOrder}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
