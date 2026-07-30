import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useClickOutside } from '@/hooks/useClickOutside'

describe('useClickOutside', () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    onClose = vi.fn<() => void>()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('calls onClose on mousedown when no ref is provided', () => {
    renderHook(() => useClickOutside(onClose))
    document.dispatchEvent(new MouseEvent('mousedown'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on mousedown outside the ref element', () => {
    const outside = document.createElement('div')
    const container = document.createElement('div')
    document.body.appendChild(outside)
    document.body.appendChild(container)

    renderHook(() => useClickOutside(onClose, { ref: { current: container } }))
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose on mousedown inside the ref element', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    renderHook(() => useClickOutside(onClose, { ref: { current: container } }))
    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on Escape key when escape:true', () => {
    renderHook(() => useClickOutside(onClose, { escape: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose on non-Escape key when escape:true', () => {
    renderHook(() => useClickOutside(onClose, { escape: true }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not listen to keydown when escape is false by default', () => {
    renderHook(() => useClickOutside(onClose))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose on touchstart when touch:true', () => {
    renderHook(() => useClickOutside(onClose, { touch: true }))
    document.dispatchEvent(new TouchEvent('touchstart'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not listen to touchstart when touch is false by default', () => {
    renderHook(() => useClickOutside(onClose))
    document.dispatchEvent(new TouchEvent('touchstart'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('removes all event listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useClickOutside(onClose, { escape: true, touch: true })
    )
    unmount()
    document.dispatchEvent(new MouseEvent('mousedown'))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.dispatchEvent(new TouchEvent('touchstart'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
