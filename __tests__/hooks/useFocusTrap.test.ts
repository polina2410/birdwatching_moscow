import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

function makeContainer(buttonCount = 2) {
  const container = document.createElement('div')
  for (let i = 0; i < buttonCount; i++) {
    container.appendChild(document.createElement('button'))
  }
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useFocusTrap — inactive / no ref', () => {
  it('does not focus anything when active is false', () => {
    const container = makeContainer()
    const first = container.children[0] as HTMLElement
    const spy = vi.spyOn(first, 'focus')

    renderHook(() => useFocusTrap({ current: container }, false))
    expect(spy).not.toHaveBeenCalled()
  })

  it('does nothing when ref.current is null', () => {
    expect(() =>
      renderHook(() => useFocusTrap({ current: null }, true))
    ).not.toThrow()
  })
})

describe('useFocusTrap — activation', () => {
  it('focuses the first focusable element on activation', () => {
    const container = makeContainer()
    const first = container.children[0] as HTMLElement
    const spy = vi.spyOn(first, 'focus')

    renderHook(() => useFocusTrap({ current: container }, true))
    expect(spy).toHaveBeenCalled()
  })
})

describe('useFocusTrap — Tab key wrapping', () => {
  it('wraps Tab from last element to first', () => {
    const container = makeContainer()
    const first = container.children[0] as HTMLElement
    const last = container.children[1] as HTMLElement

    renderHook(() => useFocusTrap({ current: container }, true))
    last.focus()

    const focusSpy = vi.spyOn(first, 'focus')
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')

    document.dispatchEvent(event)

    expect(preventSpy).toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()
  })

  it('wraps Shift+Tab from first element to last', () => {
    const container = makeContainer()
    const first = container.children[0] as HTMLElement
    const last = container.children[1] as HTMLElement

    renderHook(() => useFocusTrap({ current: container }, true))
    first.focus()

    const focusSpy = vi.spyOn(last, 'focus')
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')

    document.dispatchEvent(event)

    expect(preventSpy).toHaveBeenCalled()
    expect(focusSpy).toHaveBeenCalled()
  })

  it('does not intercept Tab when focused element is not the last', () => {
    const container = makeContainer(3)
    const middle = container.children[1] as HTMLElement

    renderHook(() => useFocusTrap({ current: container }, true))
    middle.focus()

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')

    document.dispatchEvent(event)
    expect(preventSpy).not.toHaveBeenCalled()
  })

  it('does not intercept Shift+Tab when focused element is not the first', () => {
    const container = makeContainer(3)
    const middle = container.children[1] as HTMLElement

    renderHook(() => useFocusTrap({ current: container }, true))
    middle.focus()

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')

    document.dispatchEvent(event)
    expect(preventSpy).not.toHaveBeenCalled()
  })

  it('does nothing on Tab when container has no focusable elements', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    renderHook(() => useFocusTrap({ current: container }, true))

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    expect(() => document.dispatchEvent(event)).not.toThrow()
  })
})

describe('useFocusTrap — cleanup', () => {
  it('restores focus to previously focused element on unmount', () => {
    const previous = document.createElement('button')
    document.body.appendChild(previous)
    previous.focus()

    const container = makeContainer()
    const restoreSpy = vi.spyOn(previous, 'focus')

    const { unmount } = renderHook(() => useFocusTrap({ current: container }, true))
    unmount()

    expect(restoreSpy).toHaveBeenCalled()
  })

  it('removes keydown listener on unmount', () => {
    const container = makeContainer()
    const first = container.children[0] as HTMLElement
    const last = container.children[1] as HTMLElement

    const { unmount } = renderHook(() => useFocusTrap({ current: container }, true))
    unmount()

    last.focus()
    const focusSpy = vi.spyOn(first, 'focus')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
    expect(focusSpy).not.toHaveBeenCalled()
  })
})
