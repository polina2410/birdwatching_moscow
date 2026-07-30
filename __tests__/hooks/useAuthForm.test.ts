import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuthForm } from '@/hooks/useAuthForm'
import { AUTH_ERRORS } from '@/lib/auth-errors'

describe('useAuthForm', () => {
  it('starts with null error and loading false', () => {
    const { result } = renderHook(() => useAuthForm())
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets loading true while action runs, false after', async () => {
    const { result } = renderHook(() => useAuthForm())
    let resolve!: () => void
    const action = () => new Promise<void>(r => { resolve = r })

    act(() => { result.current.run(action) })
    expect(result.current.loading).toBe(true)

    await act(async () => { resolve() })
    expect(result.current.loading).toBe(false)
  })

  it('clears previous error before running action', async () => {
    const { result } = renderHook(() => useAuthForm())
    act(() => { result.current.setError('old error') })

    await act(async () => { await result.current.run(async () => {}) })

    expect(result.current.error).toBeNull()
  })

  it('sets network error and clears loading when action throws', async () => {
    const { result } = renderHook(() => useAuthForm())

    await act(async () => {
      await result.current.run(async () => { throw new Error('fetch failed') })
    })

    expect(result.current.error).toBe(AUTH_ERRORS.network)
    expect(result.current.loading).toBe(false)
  })

  it('allows action to set a custom error via setError', async () => {
    const { result } = renderHook(() => useAuthForm())

    await act(async () => {
      await result.current.run(async () => {
        result.current.setError('custom error')
      })
    })

    expect(result.current.error).toBe('custom error')
  })
})
