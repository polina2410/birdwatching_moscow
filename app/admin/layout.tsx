import Link from 'next/link'
import { auth } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/auth/permissions'

const NAV_ITEMS = [
  { label: 'Прогулки', href: '/admin/walks' },
  { label: 'Экспедиции', href: '/admin/expeditions' },
  { label: 'Команда', href: '/admin/team' },
  { label: 'Заявки', href: '/admin/requests' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const role = session?.user?.role
  const showUsers = role != null && isSuperAdmin(role)

  return (
    <div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>{item.label}</Link>
        ))}
        {showUsers && <Link href="/admin/users">Пользователи</Link>}
      </nav>
      <main>{children}</main>
    </div>
  )
}
