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

  it('initializes and unregisters cleanly', () => {
    const teardown = initSmoothScroll()
    expect(typeof teardown).toBe('function')
    teardown()
  })
})
