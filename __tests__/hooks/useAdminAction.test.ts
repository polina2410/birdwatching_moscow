import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAdminAction } from '@/hooks/useAdminAction'

const { refreshMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

beforeEach(() => {
  refreshMock.mockReset()
  toastSuccessMock.mockReset()
  toastErrorMock.mockReset()
})

describe('useAdminAction', () => {
  it('returns act function and isPending false initially', () => {
    const { result } = renderHook(() => useAdminAction())
    expect(typeof result.current.act).toBe('function')
    expect(result.current.isPending).toBe(false)
  })

  it('calls toast.success and router.refresh when fn resolves', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAdminAction())

    await act(async () => {
      result.current.act(fn, 'Сохранено!')
    })

    expect(fn).toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledWith('Сохранено!')
    expect(refreshMock).toHaveBeenCalled()
  })

  it('calls toast.error with the Error message when fn throws an Error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Недостаточно прав'))
    const { result } = renderHook(() => useAdminAction())

    await act(async () => {
      result.current.act(fn, 'Сохранено!')
    })

    expect(toastErrorMock).toHaveBeenCalledWith('Недостаточно прав')
    expect(toastSuccessMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('calls toast.error with fallback message when fn throws a non-Error', async () => {
    const fn = vi.fn().mockRejectedValue('string error')
    const { result } = renderHook(() => useAdminAction())

    await act(async () => {
      result.current.act(fn, 'Сохранено!')
    })

    expect(toastErrorMock).toHaveBeenCalledWith('Ошибка')
  })
})
