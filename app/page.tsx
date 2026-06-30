import { auth } from '@/lib/auth'

export default async function Home() {
  const session = await auth()
  const role = session?.user?.role
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN'

  return (
    <div>
      Some text
      {isAdmin && <a href="/admin/">Админка</a>}
    </div>
  )
}
