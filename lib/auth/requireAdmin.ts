import { auth } from '@/lib/auth'
import { isAdmin, isSuperAdmin } from './permissions'

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) throw new Error('Forbidden')
  return session.user
}

export async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user || !isSuperAdmin(session.user.role)) throw new Error('Forbidden')
  return session.user
}
