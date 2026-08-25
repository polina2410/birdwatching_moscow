'use client'

import { SessionProvider } from 'next-auth/react'
import { NavigationGuardProvider } from './NavigationGuardContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NavigationGuardProvider>{children}</NavigationGuardProvider>
    </SessionProvider>
  )
}
