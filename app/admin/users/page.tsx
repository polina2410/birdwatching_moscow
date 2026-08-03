import { prisma } from '@/lib/prisma'
import { changeUserRole, blockUser, unblockUser } from '@/app/admin/users/_actions'
import type { Role } from '@/generated/prisma/client'

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div>
      <h1>Пользователи</h1>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Имя</th>
            <th>Роль</th>
            <th>Заблокирован</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.name}</td>
              <td>{u.role}</td>
              <td>{u.blockedAt ? 'Да' : 'Нет'}</td>
              <td>
                <form action={async (formData: FormData) => {
                  'use server'
                  const newRole = formData.get('newRole') as Role
                  await changeUserRole(u.id, newRole)
                }}>
                  <select name="newRole" defaultValue={u.role}>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPERADMIN">SUPERADMIN</option>
                  </select>
                  <button type="submit">Изменить роль</button>
                </form>
                {u.blockedAt == null ? (
                  <form action={async () => {
                    'use server'
                    await blockUser(u.id)
                  }}>
                    <button type="submit">Заблокировать</button>
                  </form>
                ) : (
                  <form action={async () => {
                    'use server'
                    await unblockUser(u.id)
                  }}>
                    <button type="submit">Разблокировать</button>
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
