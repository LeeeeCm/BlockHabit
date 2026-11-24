import { describe, it, expect } from 'vitest'
import { findScrollableParent, initSmoothScroll } from './smoothScroll'

describe('smoothScroll', () => {
  it('finds scrollable parent container with overflow-y auto', () => {
    const parent = document.createElement('div')
    parent.style.overflowY = 'auto'
    Object.defineProperty(parent, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(parent, 'scrollHeight', { value: 600, configurable: true })

    const child = document.createElement('div')
    parent.appendChild(child)
    document.body.appendChild(parent)

    const found = findScrollableParent(child)
    expect(found).toBe(parent)

    document.body.removeChild(parent)
  })

  it('returns null if element has no scrollable parent', () => {
    const nonScrollable = document.createElement('div')
    document.body.appendChild(nonScrollable)

    const found = findScrollableParent(nonScrollable)
    expect(found).toBeNull()

    document.body.removeChild(nonScrollable)
  })

  it('does not fall back to the page behind an open modal', () => {
    const content = document.createElement('div')
    content.className = 'content'
    content.style.overflowY = 'auto'
    Object.defineProperty(content, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(content, 'scrollHeight', { value: 800, configurable: true })
    document.body.appendChild(content)

    const overlay = document.createElement('div')
    overlay.className = 'overlay'
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const body = document.createElement('div')
    dialog.appendChild(body)
    overlay.appendChild(dialog)
    document.body.appendChild(overlay)

    const teardown = initSmoothScroll()
    const ev = new WheelEvent('wheel', {
      deltaY: 100,
      deltaMode: 0,
      cancelable: true,
      bubbles: true
    })
    body.dispatchEvent(ev)

    expect(findScrollableParent(body)).toBeNull()
    expect(ev.defaultPrevented).toBe(true)
    expect(content.scrollTop).toBe(0)

    teardown()
    document.body.removeChild(overlay)
    document.body.removeChild(content)
  })

  it('finds the dialog body instead of the page behind it', () => {
    const content = document.createElement('div')
    content.className = 'content'
    content.style.overflowY = 'auto'
    Object.defineProperty(content, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(content, 'scrollHeight', { value: 800, configurable: true })
    document.body.appendChild(content)

    const overlay = document.createElement('div')
    overlay.className = 'overlay'
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const dialogBody = document.createElement('div')
    dialogBody.className = 'dialog-body'
    dialogBody.style.overflowY = 'auto'
    Object.defineProperty(dialogBody, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(dialogBody, 'scrollHeight', { value: 500, configurable: true })
    dialog.appendChild(dialogBody)
    overlay.appendChild(dialog)
    document.body.appendChild(overlay)

    expect(findScrollableParent(dialogBody)).toBe(dialogBody)

    document.body.removeChild(overlay)
    document.body.removeChild(content)
  })

  it('initializes and unregisters cleanly', () => {
    const teardown = initSmoothScroll()
    expect(typeof teardown).toBe('function')
    teardown()
  })
})
