import { prisma } from '@/lib/prisma'
import { updateRequestStatus } from '@/app/admin/requests/_actions'

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
            <th>Тип</th>
            <th>Экспедиция</th>
            <th>Статус</th>
            <th>Дата</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.email}</td>
              <td>{r.type}</td>
              <td>{r.expedition?.title ?? '—'}</td>
              <td>{r.status}</td>
              <td>{r.createdAt.toLocaleDateString('ru-RU')}</td>
              <td>
                {r.status === 'NEW' && (
                  <form action={async () => {
                    'use server'
                    await updateRequestStatus(r.id, 'WAITLIST')
                  }}>
                    <button type="submit">→ Лист ожидания</button>
                  </form>
                )}
                {r.status === 'WAITLIST' && (
                  <form action={async () => {
                    'use server'
                    await updateRequestStatus(r.id, 'NEW')
                  }}>
                    <button type="submit">→ Новая</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
