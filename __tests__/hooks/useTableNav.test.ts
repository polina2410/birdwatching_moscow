import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableNav } from '@/hooks/useTableNav'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams('role=ADMIN&page=3'),
}))

describe('useTableNav', () => {
  beforeEach(() => mockPush.mockClear())

  describe('updateParam', () => {
    it('sets a param and resets page', () => {
      const { result } = renderHook(() => useTableNav())

      act(() => result.current.updateParam('role', 'USER'))

      expect(mockPush).toHaveBeenCalledWith('/admin/users?role=USER')
    })

    it('deletes the param and resets page when value is empty', () => {
      const { result } = renderHook(() => useTableNav())

      act(() => result.current.updateParam('role', ''))

      expect(mockPush).toHaveBeenCalledWith('/admin/users?')
    })

    it('preserves unrelated params when setting', () => {
      const { result } = renderHook(() => useTableNav())

      act(() => result.current.updateParam('search', 'alice'))

      const url = mockPush.mock.calls[0][0] as string
      const sp = new URLSearchParams(url.split('?')[1])
      expect(sp.get('role')).toBe('ADMIN')
      expect(sp.get('search')).toBe('alice')
      expect(sp.has('page')).toBe(false)
    })
  })

  describe('goPage', () => {
    it('sets page while preserving other params', () => {
      const { result } = renderHook(() => useTableNav())

      act(() => result.current.goPage(5))

      const url = mockPush.mock.calls[0][0] as string
      const sp = new URLSearchParams(url.split('?')[1])
      expect(sp.get('page')).toBe('5')
      expect(sp.get('role')).toBe('ADMIN')
    })
  })
})
