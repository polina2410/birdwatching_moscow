import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSession: vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' }),
}))

import { Providers } from '@/components/Providers'
import { useNavigationGuardContext } from '@/components/NavigationGuardContext'

function GuardConsumer() {
  useNavigationGuardContext()
  return <span>guard ok</span>
}

describe('Providers component', () => {
  it('renders children', () => {
    render(
      <Providers>
        <span data-testid="child">hello</span>
      </Providers>
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })

  it('does not throw for a child using useNavigationGuardContext', () => {
    expect(() =>
      render(
        <Providers>
          <GuardConsumer />
        </Providers>
      )
    ).not.toThrow()
    expect(screen.getByText('guard ok')).toBeDefined()
  })
})

describe('app/layout.tsx — Server Component constraint', () => {
  it('does not contain a "use client" directive', () => {
    const layoutPath = path.join(process.cwd(), 'app', 'layout.tsx')
    const content = fs.readFileSync(layoutPath, 'utf-8')
    expect(content).not.toMatch(/'use client'/)
    expect(content).not.toMatch(/"use client"/)
  })
})
