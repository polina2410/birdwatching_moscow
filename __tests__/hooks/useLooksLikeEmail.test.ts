import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLooksLikeEmail } from '@/hooks/useLooksLikeEmail'

describe('useLooksLikeEmail', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns false immediately before the delay fires', () => {
    const { result } = renderHook(() => useLooksLikeEmail('user@example.com'))
    expect(result.current).toBe(false)
  })

  it('returns true after delay for a valid email', async () => {
    const { result } = renderHook(() => useLooksLikeEmail('user@example.com'))
    await act(async () => { vi.runAllTimers() })
    expect(result.current).toBe(true)
  })

  it('returns false after delay for an empty string', async () => {
    const { result } = renderHook(() => useLooksLikeEmail(''))
    await act(async () => { vi.runAllTimers() })
    expect(result.current).toBe(false)
  })

  it('returns false after delay for a string without @', async () => {
    const { result } = renderHook(() => useLooksLikeEmail('notanemail'))
    await act(async () => { vi.runAllTimers() })
    expect(result.current).toBe(false)
  })

  it('returns false after delay for a string with @ but no domain dot', async () => {
    const { result } = renderHook(() => useLooksLikeEmail('user@localhost'))
    await act(async () => { vi.runAllTimers() })
    expect(result.current).toBe(false)
  })

  it('updates to false when value changes from valid to invalid', async () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useLooksLikeEmail(value),
      { initialProps: { value: 'user@example.com' } }
    )
    await act(async () => { vi.runAllTimers() })
    expect(result.current).toBe(true)

    rerender({ value: 'notvalid' })
    await act(async () => { vi.runAllTimers() })
    expect(result.current).toBe(false)
  })

  it('cancels the previous timer when value changes before delay fires', async () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useLooksLikeEmail(value),
      { initialProps: { value: 'user@example.com' } }
    )
    rerender({ value: 'notvalid' })
    await act(async () => { vi.runAllTimers() })
    expect(result.current).toBe(false)
  })

  it('respects a custom delay', async () => {
    const { result } = renderHook(() => useLooksLikeEmail('user@example.com', 1000))
    await act(async () => { vi.advanceTimersByTime(999) })
    expect(result.current).toBe(false)
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe(true)
  })
})
