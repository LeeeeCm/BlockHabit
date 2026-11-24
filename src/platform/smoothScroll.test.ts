import { describe, it, expect, vi, afterEach } from 'vitest'
import { findScrollableParent, initSmoothScroll } from './smoothScroll'

function makeScrollableContainer() {
  const parent = document.createElement('div')
  parent.style.overflowY = 'auto'
  parent.scrollTop = 100
  Object.defineProperty(parent, 'clientHeight', { value: 200, configurable: true })
  Object.defineProperty(parent, 'scrollHeight', { value: 800, configurable: true })
  const child = document.createElement('div')
  parent.appendChild(child)
  document.body.appendChild(parent)
  return {
    parent,
    child,
    cleanup: () => document.body.removeChild(parent)
  }
}

describe('smoothScroll', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia
    })
  })

  it('finds scrollable parent container with overflow-y auto', () => {
    const { parent, child, cleanup } = makeScrollableContainer()
    const found = findScrollableParent(child)
    expect(found).toBe(parent)
    cleanup()
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

  it('intercepts discrete mouse wheel ticks and smoothly interpolates scrollTop', () => {
    const rafCallbacks: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    const { parent, child, cleanup } = makeScrollableContainer()
    const teardown = initSmoothScroll()

    const ev = new WheelEvent('wheel', {
      deltaY: 100,
      deltaMode: 0,
      cancelable: true,
      bubbles: true
    })
    child.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(true)
    expect(rafCallbacks.length).toBe(1)

    rafCallbacks[0](16)
    expect(parent.scrollTop).toBeGreaterThan(100)
    expect(parent.scrollTop).toBeLessThan(144)

    teardown()
    cleanup()
  })

  it('passes through precision trackpad micro-deltas to native scrolling', () => {
    const { child, cleanup } = makeScrollableContainer()
    const teardown = initSmoothScroll()

    const ev = new WheelEvent('wheel', {
      deltaY: 8,
      deltaMode: 0,
      cancelable: true,
      bubbles: true
    })
    child.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(false)

    teardown()
    cleanup()
  })

  it('passes through wheel events when prefers-reduced-motion is reduce', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    })
    const { child, cleanup } = makeScrollableContainer()
    const teardown = initSmoothScroll()

    const ev = new WheelEvent('wheel', {
      deltaY: 120,
      deltaMode: 0,
      cancelable: true,
      bubbles: true
    })
    child.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(false)

    teardown()
    cleanup()
  })
})
