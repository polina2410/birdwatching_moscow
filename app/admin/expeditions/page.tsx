import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function ExpeditionsPage() {
  const expeditions = await prisma.expedition.findMany({
    where: { status: { not: 'DELETED' } },
    include: { guides: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div>
      <h1>Экспедиции</h1>
      <Link href="/admin/expeditions/new">Новая экспедиция</Link>
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Гиды</th>
            <th>Дата</th>
            <th>Статус</th>
            <th>Мест</th>
          </tr>
        </thead>
        <tbody>
          {expeditions.map((e) => (
            <tr key={e.id}>
              <td><a href={`/admin/expeditions/${e.id}`}>{e.title}</a></td>
              <td>{e.guides.map((g) => g.name).join(', ')}</td>
              <td>{e.startsAt.toLocaleString('ru-RU')}</td>
              <td>{e.status}</td>
              <td>{e.spotsLeft} / {e.totalSpots}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
