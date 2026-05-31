'use client'

import { createContext, useContext, useRef } from 'react'

type Guard = ((proceed: () => void) => void) | null

interface NavigationGuardContextValue {
  guardRef: React.RefObject<Guard>
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null)

export function useNavigationGuardContext() {
  const ctx = useContext(NavigationGuardContext)
  if (!ctx) throw new Error('useNavigationGuardContext must be used within NavigationGuardProvider')
  return ctx
}

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const guardRef = useRef<Guard>(null)
  return (
    <NavigationGuardContext.Provider value={{ guardRef }}>
      {children}
    </NavigationGuardContext.Provider>
  )
}
