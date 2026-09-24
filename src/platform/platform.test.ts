import { describe, it, expect, vi, beforeEach } from 'vitest'
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
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 0,
    })
  })

  it('detects desktop environment by default when window width is large', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    expect(detectPlatform()).toBe('desktop')
  })

  it('detects mobile when userAgent indicates mobile device or narrow viewport with touch', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 })
    Object.defineProperty(navigator, 'maxTouchPoints', { writable: true, configurable: true, value: 5 })
    expect(detectPlatform()).toBe('mobile')
  })

  it('detects mobile when in Tauri mobile environment', () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      writable: true,
      configurable: true,
      value: {},
    })
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    })
    expect(detectPlatform()).toBe('mobile')
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })
})

describe('Haptics trigger', () => {
  it('calls navigator.vibrate when available', () => {
    const vibrateSpy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { writable: true, configurable: true, value: vibrateSpy })
    triggerHaptic('light')
    expect(vibrateSpy).toHaveBeenCalledWith(10)
    triggerHaptic('medium')
    expect(vibrateSpy).toHaveBeenCalledWith(25)
    triggerHaptic('heavy')
    expect(vibrateSpy).toHaveBeenCalledWith(45)
    triggerHaptic('success')
    expect(vibrateSpy).toHaveBeenCalledWith([15, 50, 20])
  })

  it('safely handles missing navigator.vibrate gracefully without throwing', () => {
    Object.defineProperty(navigator, 'vibrate', { writable: true, configurable: true, value: undefined })
    expect(() => triggerHaptic('light')).not.toThrow()
  })

  it('safely handles exception thrown by navigator.vibrate', () => {
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: () => {
        throw new Error('SecurityError')
      },
    })
    expect(() => triggerHaptic('light')).not.toThrow()
  })
})

describe('usePlatform hook', () => {
  it('returns platform state and haptic helper', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    Object.defineProperty(navigator, 'maxTouchPoints', { writable: true, configurable: true, value: 0 })

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
    expect(typeof result?.haptic).toBe('function')

    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
