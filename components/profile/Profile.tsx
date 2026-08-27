'use client'

import { signOut } from 'next-auth/react'

export const Profile = () => {
  return (
    <main>
      <button onClick={() => signOut({ redirectTo: '/login' })}>Выйти</button>
    </main>
  )
}
