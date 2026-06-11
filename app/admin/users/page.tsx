import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth/requireAdmin'
import { UsersTable } from '@/components/admin/UsersTable'
import type { Role } from '@/generated/prisma/client'

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{
    page?: string
    role?: string
    search?: string
    showDeleted?: string
    showBlocked?: string
  }>
}

export default async function AdminUsersPage({ searchParams }: Props) {
  await requireSuperAdmin()
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))
  const role = params.role as Role | undefined
  const search = params.search?.trim() ?? ''
  const showDeleted = params.showDeleted === 'true'
  const showBlocked = params.showBlocked === 'true'

  const where = {
    ...(role ? { role } : {}),
    ...(!showDeleted ? { deletedAt: null } : {}),
    ...(!showBlocked ? { blockedAt: null } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        deletedAt: true,
        blockedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Пользователи</h1>
      <UsersTable users={users} page={page} totalPages={totalPages} />
    </div>
  )
}
