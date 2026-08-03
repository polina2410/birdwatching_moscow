import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: authMock }))

import AdminLayout from '@/app/admin/layout'

describe('AdminLayout navigation', () => {
  it('shows Пользователи nav item for SUPERADMIN', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', role: 'SUPERADMIN', name: 'SA' } })
    render(await AdminLayout({ children: null }))
    expect(screen.getByText('Пользователи')).toBeDefined()
  })

  it('does not show Пользователи nav item for ADMIN', async () => {
    authMock.mockResolvedValue({ user: { id: 'u2', role: 'ADMIN', name: 'A' } })
    render(await AdminLayout({ children: null }))
    expect(screen.queryByText('Пользователи')).toBeNull()
  })

  it('shows all other nav items for ADMIN', async () => {
    authMock.mockResolvedValue({ user: { id: 'u2', role: 'ADMIN', name: 'A' } })
    render(await AdminLayout({ children: null }))
    expect(screen.getByText('Прогулки')).toBeDefined()
    expect(screen.getByText('Экспедиции')).toBeDefined()
    expect(screen.getByText('Команда')).toBeDefined()
    expect(screen.getByText('Заявки')).toBeDefined()
  })
})
