import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/auth/permissions'
import { ROLE_LABELS } from '@/lib/auth/roles'
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/sonner'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) redirect('/')

  const { name, role } = session.user

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/40 flex flex-col">
        <div className="p-4 border-b">
          <p className="font-semibold text-sm">Birdwatching Moscow</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{name}</p>
          <Badge variant="secondary" className="mt-1 text-xs">{ROLE_LABELS[role]}</Badge>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <Link href="/admin/walks" className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent">
            Прогулки
          </Link>
          <Link href="/admin/expeditions" className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent">
            Экспедиции
          </Link>
          <Link href="/admin/team" className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent">
            Команда
          </Link>
          <Link href="/admin/requests" className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent">
            Заявки
          </Link>
          <Link href="/admin/users" className="flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent">
            Пользователи
          </Link>
        </nav>
        <div className="p-4 border-t">
          <AdminLogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
      <Toaster />
    </div>
  )
}
