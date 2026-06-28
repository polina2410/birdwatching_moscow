import Link from 'next/link'
import { auth } from '@/lib/auth'
import { isAdmin } from '@/lib/auth/permissions'
import { buttonVariants } from '@/components/ui/button'

export default async function Home() {
  const session = await auth()
  const showAdminLink = session?.user?.role != null && isAdmin(session.user.role)

  return (
    <div>
      Some text
      {showAdminLink && (
        <Link href="/admin" className={buttonVariants()}>Админка</Link>
      )}
    </div>
  )
}
