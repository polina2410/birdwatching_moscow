import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/users',
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/app/admin/users/_actions', () => ({
  changeUserRole: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  getUserRoleHistory: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/hooks/useAdminAction', () => ({
  useAdminAction: () => ({ act: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/useDebounce', () => ({
  useDebounce: (v: string) => v,
}))

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { UsersTable } from '@/components/admin/UsersTable'

type UserRow = {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN' | 'SUPERADMIN'
  createdAt: Date
  deletedAt: Date | null
  blockedAt: Date | null
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'USER',
    createdAt: new Date('2024-01-01'),
    deletedAt: null,
    blockedAt: null,
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('UsersTable — canChangeRole prop', () => {
  it('hides the role-change action when canChangeRole is false', () => {
    render(
      <UsersTable
        users={[makeUser()]}
        page={1}
        totalPages={1}
        canChangeRole={false}
      />
    )

    const [trigger] = screen.getAllByText('•••')
    fireEvent.click(trigger)

    expect(screen.queryByText('Изменить роль')).toBeNull()
  })
})