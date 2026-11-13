import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { detectPlatform, triggerHaptic } from './index'
import { usePlatform, type UsePlatformResult } from './usePlatform'

describe('Platform detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 0
    })
  })

  afterEach(() => {
    if ('__TAURI_INTERNALS__' in window) {
      Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
    }
  })

  it('detects desktop environment by default when window width is large', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    expect(detectPlatform()).toBe('desktop')
  })

  it('detects mobile when userAgent indicates mobile device or narrow viewport with touch', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 5
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (q: string) => ({ matches: q.includes('coarse'), media: q })
    })
    expect(detectPlatform()).toBe('mobile')
  })

  it('keeps desktop paradigm on touch devices with fine pointer (touch-screen laptop)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 5
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      // fine pointer：coarse 媒体查询不匹配
      value: (q: string) => ({ matches: false, media: q })
    })
    expect(detectPlatform()).toBe('desktop')
  })

  it('detects mobile when in Tauri mobile environment', () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      writable: true,
      configurable: true,
      value: {}
    })
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'
    })
    expect(detectPlatform()).toBe('mobile')
  })

  it('detects mobile when in Tauri mobile environment on iPadOS', () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      writable: true,
      configurable: true,
      value: {}
    })
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 5
    })
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    })
    expect(detectPlatform()).toBe('mobile')
  })

  it('returns desktop when navigator is undefined', () => {
    const originalNavigator = window.navigator
    try {
      Object.defineProperty(window, 'navigator', {
        value: undefined,
        configurable: true
      })
      expect(detectPlatform()).toBe('desktop')
    } finally {
      Object.defineProperty(window, 'navigator', {
        value: originalNavigator,
        configurable: true
      })
    }
  })
})

describe('Haptics trigger', () => {
  it('calls navigator.vibrate when available', () => {
    const vibrateSpy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: vibrateSpy
    })
    triggerHaptic('light')
    expect(vibrateSpy).toHaveBeenCalledWith(10)
    triggerHaptic('medium')
    expect(vibrateSpy).toHaveBeenCalledWith(25)
    triggerHaptic('heavy')
    expect(vibrateSpy).toHaveBeenCalledWith(45)
    triggerHaptic('success')
    expect(vibrateSpy).toHaveBeenCalledWith([15, 50, 20])
    triggerHaptic('selection')
    expect(vibrateSpy).toHaveBeenCalledWith(8)
    triggerHaptic('warning')
    expect(vibrateSpy).toHaveBeenCalledWith([20, 40, 20])
  })

  it('safely handles missing navigator.vibrate gracefully without throwing', () => {
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: undefined
    })
    expect(() => triggerHaptic('light')).not.toThrow()
  })

  it('safely handles exception thrown by navigator.vibrate', () => {
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: () => {
        throw new Error('SecurityError')
      }
    })
    expect(() => triggerHaptic('light')).not.toThrow()
  })
})

describe('usePlatform hook', () => {
  it('returns platform state and stable haptic helper', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 0
    })

    let result: UsePlatformResult | undefined
    function TestComponent() {
      result = usePlatform()
      return null
    }

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(React.createElement(TestComponent))
    })

    expect(result).toBeDefined()
    expect(result?.platform).toBe('desktop')
    expect(result?.isDesktop).toBe(true)
    expect(result?.isMobile).toBe(false)
    expect(result?.haptic).toBe(triggerHaptic)

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
