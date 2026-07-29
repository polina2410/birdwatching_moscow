import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNavigationGuard } from '@/hooks/useNavigationGuard'
import { NavigationGuardProvider, useNavigationGuardContext } from '@/context/NavigationGuardContext'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NavigationGuardProvider>{children}</NavigationGuardProvider>
)

// Renders both the guard and the context so tests can inspect guardRef directly
function useTestHarness(isActive: boolean, onBlock: (proceed: () => void) => void) {
  const ctx = useNavigationGuardContext()
  useNavigationGuard(isActive, onBlock)
  return ctx
}

describe('useNavigationGuard', () => {
  let onBlock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onBlock = vi.fn()
  })

  it('throws when used outside NavigationGuardProvider', () => {
    expect(() =>
      renderHook(() => useNavigationGuard(false, onBlock))
    ).toThrow('useNavigationGuardContext must be used within NavigationGuardProvider')
  })

  it('registers a function in guardRef when isActive is true', () => {
    const { result } = renderHook(() => useTestHarness(true, onBlock), { wrapper })
    expect(result.current.guardRef.current).toBeTypeOf('function')
  })

  it('keeps guardRef null when isActive is false', () => {
    const { result } = renderHook(() => useTestHarness(false, onBlock), { wrapper })
    expect(result.current.guardRef.current).toBeNull()
  })

  it('clears guardRef on unmount', () => {
    const { result, unmount } = renderHook(() => useTestHarness(true, onBlock), { wrapper })
    unmount()
    expect(result.current.guardRef.current).toBeNull()
  })

  it('invokes onBlock with proceed when the registered guard is called', () => {
    const { result } = renderHook(() => useTestHarness(true, onBlock), { wrapper })
    const proceed = vi.fn()
    result.current.guardRef.current?.(proceed)
    expect(onBlock).toHaveBeenCalledWith(proceed)
  })

  it('uses the latest onBlock when it changes between renders', () => {
    const onBlock2 = vi.fn()
    let block = onBlock

    const { result, rerender } = renderHook(() => useTestHarness(true, block), { wrapper })

    block = onBlock2
    rerender()

    const proceed = vi.fn()
    result.current.guardRef.current?.(proceed)

    expect(onBlock).not.toHaveBeenCalled()
    expect(onBlock2).toHaveBeenCalledWith(proceed)
  })

  it('adds beforeunload listener when isActive is true', () => {
    const spy = vi.spyOn(window, 'addEventListener')
    renderHook(() => useTestHarness(true, onBlock), { wrapper })
    expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    spy.mockRestore()
  })

  it('does not add beforeunload listener when isActive is false', () => {
    const spy = vi.spyOn(window, 'addEventListener')
    renderHook(() => useTestHarness(false, onBlock), { wrapper })
    expect(spy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function))
    spy.mockRestore()
  })

  it('removes beforeunload listener on unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useTestHarness(true, onBlock), { wrapper })
    unmount()
    expect(spy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    spy.mockRestore()
  })
})
