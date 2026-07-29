import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToggle } from '@/hooks/useToggle'

describe('useToggle', () => {
  it('starts false by default', () => {
    const { result } = renderHook(() => useToggle())
    expect(result.current[0]).toBe(false)
  })

  it('starts with custom initial value', () => {
    const { result } = renderHook(() => useToggle(true))
    expect(result.current[0]).toBe(true)
  })

  it('toggle flips false to true', () => {
    const { result } = renderHook(() => useToggle())
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
  })

  it('toggle flips true to false', () => {
    const { result } = renderHook(() => useToggle(true))
    act(() => result.current[1]())
    expect(result.current[0]).toBe(false)
  })

  it('toggle twice returns to original value', () => {
    const { result } = renderHook(() => useToggle())
    act(() => {
      result.current[1]()
      result.current[1]()
    })
    expect(result.current[0]).toBe(false)
  })

  it('setValue sets an explicit value', () => {
    const { result } = renderHook(() => useToggle())
    act(() => result.current[2](true))
    expect(result.current[0]).toBe(true)
    act(() => result.current[2](false))
    expect(result.current[0]).toBe(false)
  })
})
