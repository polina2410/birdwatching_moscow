import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function WalksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}) {
  const { status, q, page } = await searchParams
  const pageNum = Math.max(1, parseInt(page ?? '1', 10))
  const skip = (pageNum - 1) * 20

  const walks = await prisma.walk.findMany({
    where: {
      status: { not: 'DELETED' },
      ...(status ? { status: status as never } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    },
    include: { guide: { select: { name: true } }, _count: { select: { tickets: true } } },
    orderBy: { createdAt: 'desc' },
    skip,
    take: 20,
  })

  return (
    <div>
      <h1>Прогулки</h1>
      <Link href="/admin/walks/new">Новая прогулка</Link>
      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Гид</th>
            <th>Дата</th>
            <th>Статус</th>
            <th>Цена</th>
            <th>Билеты</th>
          </tr>
        </thead>
        <tbody>
          {walks.map((w) => (
            <tr key={w.id}>
              <td><a href={`/admin/walks/${w.id}`}>{w.title}</a></td>
              <td>{w.guide.name}</td>
              <td>{w.startsAt.toLocaleString('ru-RU')}</td>
              <td>{w.status}</td>
              <td>{(w.priceKopecks / 100).toFixed(0)} ₽</td>
              <td>{w._count.tickets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
