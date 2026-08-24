import { prisma } from '@/lib/prisma'

export default async function RequestsPage() {
  const requests = await prisma.request.findMany({
    include: { expedition: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div>
      <h1>Заявки</h1>
      <table>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Email</th>
            <th>Экспедиция</th>
            <th>Дата</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.email}</td>
              <td>{r.expedition?.title ?? '—'}</td>
              <td>{r.createdAt.toLocaleDateString('ru-RU')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
