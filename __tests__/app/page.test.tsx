import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Session } from 'next-auth'
import type { Role } from '@/generated/prisma/client'
import Home from '@/app/page'
import { auth } from '@/lib/auth'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

// auth has multiple overloads (NextMiddleware and server-component); cast to the
// server-component signature so TypeScript resolves mockResolvedValue correctly.
const authMock = auth as unknown as Mock<() => Promise<Session | null>>

function mockSession(role: string | null) {
  if (role === null) {
    authMock.mockResolvedValue(null)
  } else {
    const session: Session = {
      user: { id: '1', name: 'Test', email: 'a@b.com', role: role as Role },
      expires: '2099-01-01T00:00:00.000Z',
    }
    authMock.mockResolvedValue(session)
  }
}

beforeEach(() => vi.clearAllMocks())

describe('Админка link — shown for privileged roles', () => {
  it('renders the link for ADMIN', async () => {
    mockSession('ADMIN')
    render(await Home())
    const link = screen.getByRole('link', { name: 'Админка' })
    expect(link.getAttribute('href')).toBe('/admin/')
  })

  it('renders the link for SUPERADMIN', async () => {
    mockSession('SUPERADMIN')
    render(await Home())
    const link = screen.getByRole('link', { name: 'Админка' })
    expect(link.getAttribute('href')).toBe('/admin/')
  })
})

describe('Админка link — hidden for non-privileged roles', () => {
  it('does not render the link for USER', async () => {
    mockSession('USER')
    render(await Home())
    expect(authMock).toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Админка' })).toBeNull()
  })

  it('does not render the link when unauthenticated', async () => {
    mockSession(null)
    render(await Home())
    expect(authMock).toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Админка' })).toBeNull()
  })
})
