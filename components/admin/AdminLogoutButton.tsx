'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export const AdminLogoutButton = () => (
  <Button variant="outline" size="sm" className="w-full" onClick={() => signOut({ callbackUrl: '/login' })}>
    Выйти
  </Button>
)