// The bare import pulls `next-auth/jwt` into the program. Without it — i.e. if
// no source file imports the module — the JWT augmentation below declares a
// fresh ambient module instead of merging, and `token.id` degrades to unknown.
import 'next-auth/jwt'
import type { DefaultSession } from 'next-auth'
import type { Role } from '@/generated/prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession['user']
  }

  interface User {
    role: Role
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
  }
}