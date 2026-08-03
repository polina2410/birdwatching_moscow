import type { Role } from '@/generated/prisma/client'

/** Shape returned by an `authorize` callback and stored in the JWT. */
export interface AuthorizedUser {
  id: string
  email: string
  name: string
  role: Role
}

