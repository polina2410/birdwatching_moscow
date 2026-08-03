import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: authMock }))

import Home from '@/app/page'

describe('Home page', () => {
  it('renders without errors', async () => {
    authMock.mockResolvedValue(null)
    render(await Home())
    expect(screen.getByRole('main')).toBeDefined()
  })
})

describe('Home page admin link', () => {
  it('renders Админка link to /admin/walks for ADMIN', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN', name: 'Admin' } })
    const { container } = render(await Home())
    const link = container.querySelector('a[href="/admin/walks"]')
    expect(link).not.toBeNull()
    expect(link?.textContent).toBe('Админка')
  })

  it('renders Админка link for SUPERADMIN', async () => {
    authMock.mockResolvedValue({ user: { id: 'u2', role: 'SUPERADMIN', name: 'SA' } })
    const { container } = render(await Home())
    expect(container.querySelector('a[href="/admin/walks"]')).not.toBeNull()
  })

  it('does not render Админка link for USER', async () => {
    authMock.mockResolvedValue({ user: { id: 'u3', role: 'USER', name: 'User' } })
    const { container } = render(await Home())
    expect(container.querySelector('a[href="/admin/walks"]')).toBeNull()
  })

  it('does not render Админка link when unauthenticated', async () => {
    authMock.mockResolvedValue(null)
    const { container } = render(await Home())
    expect(container.querySelector('a[href="/admin/walks"]')).toBeNull()
  })
})
