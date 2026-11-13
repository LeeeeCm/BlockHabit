import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { calculatePinchDistance, calculateTouchCenter, clampZoom, isQuickTap } from './touchGesture'
import { BuildScene } from './BuildScene'
import { ShowcaseScene } from './ShowcaseScene'
import * as platform from '../platform'
import type { Blueprint, ShowcasePlacement } from '../types'

describe('touchGesture math helpers', () => {
  it('calculates distance between two touch points correctly', () => {
    const p1 = { clientX: 0, clientY: 0 }
    const p2 = { clientX: 30, clientY: 40 }
    expect(calculatePinchDistance(p1, p2)).toBe(50)
  })

  it('calculates midpoint between two touch points', () => {
    const p1 = { clientX: 10, clientY: 20 }
    const p2 = { clientX: 30, clientY: 40 }
    const center = calculateTouchCenter(p1, p2)
    expect(center.x).toBe(20)
    expect(center.y).toBe(30)
  })

  it('clamps zoom scale to boundaries', () => {
    expect(clampZoom(0.2, 0.5, 3.0)).toBe(0.5)
    expect(clampZoom(4.0, 0.5, 3.0)).toBe(3.0)
    expect(clampZoom(1.5, 0.5, 3.0)).toBe(1.5)
    // Default boundaries
    expect(clampZoom(0.1)).toBe(0.5)
    expect(clampZoom(5.0)).toBe(3.0)
  })

  it('detects quick tap accurately (< 250ms and < 8px displacement)', () => {
    expect(isQuickTap(100, 4)).toBe(true)
    expect(isQuickTap(249, 7.9)).toBe(true)
    expect(isQuickTap(250, 4)).toBe(false)
    expect(isQuickTap(300, 2)).toBe(false)
    expect(isQuickTap(100, 8)).toBe(false)
    expect(isQuickTap(100, 15)).toBe(false)
  })
})

describe('Scene Touch Gestures Integration', () => {
  let hapticSpy: MockInstance

  const mockBlueprint: Blueprint = {
    id: 'bp_sample',
    blocks: [
      { x: 0, y: 0, z: 0, type: 'basic' },
      { x: 1, y: 0, z: 0, type: 'basic' }
    ]
  }

  function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    return Object.assign(event, { touches })
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    hapticSpy = vi.spyOn(platform, 'triggerHaptic').mockImplementation(() => {})

    const mockCtx = new Proxy(
      {
        canvas: document.createElement('canvas'),
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() })
      },
      {
        get: (target, prop) => {
          if (prop in target) return (target as Record<string | symbol, unknown>)[prop]
          return vi.fn()
        }
      }
    )
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D)
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof window.ResizeObserver
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles single-finger touch pan, pinch-zoom, and tap in BuildScene', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        React.createElement(BuildScene, {
          blueprint: mockBlueprint,
          placedCount: 2,
          interactiveInspect: true
        })
      )
    })

    const canvas = container.querySelector('canvas')!
    expect(canvas).toBeDefined()

    // 1. Single finger pan
    act(() => {
      canvas.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]))
      canvas.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 150, clientY: 120 }]))
      canvas.dispatchEvent(createTouchEvent('touchend', []))
    })

    // 2. Two-finger pinch zoom
    act(() => {
      canvas.dispatchEvent(
        createTouchEvent('touchstart', [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 }
        ])
      )
      canvas.dispatchEvent(
        createTouchEvent('touchmove', [
          { clientX: 80, clientY: 100 },
          { clientX: 240, clientY: 100 }
        ])
      )
      canvas.dispatchEvent(createTouchEvent('touchend', []))
    })

    // 3. Quick tap on block (0, 0, 0)
    act(() => {
      canvas.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 0, clientY: 10 }]))
      canvas.dispatchEvent(createTouchEvent('touchend', []))
    })

    expect(hapticSpy).toHaveBeenCalledWith('light')
    expect(container.querySelector('.brick-inspect-popover')).not.toBeNull()

    // 4. Quick tap on empty ground outside blocks clears popover
    act(() => {
      canvas.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 800, clientY: 800 }]))
      canvas.dispatchEvent(createTouchEvent('touchend', []))
    })

    expect(container.querySelector('.brick-inspect-popover')).toBeNull()
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('handles touch gestures and model tap in ShowcaseScene', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const onSelectModel = vi.fn()
    const onUpdatePlacement = vi.fn()
    const placements: ShowcasePlacement[] = [{ blueprintId: 'bp_sample', gridX: 2, gridY: 2 }]

    act(() => {
      root.render(
        React.createElement(ShowcaseScene, {
          placements,
          blueprintsMap: { bp_sample: mockBlueprint },
          onSelectModel,
          onUpdatePlacement
        })
      )
    })

    const canvas = container.querySelector('canvas')!
    expect(canvas).toBeDefined()

    // 1. Single finger pan
    act(() => {
      canvas.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 50, clientY: 50 }]))
      canvas.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 70, clientY: 60 }]))
      canvas.dispatchEvent(createTouchEvent('touchend', []))
    })

    // 2. Pinch zoom
    act(() => {
      canvas.dispatchEvent(
        createTouchEvent('touchstart', [
          { clientX: 50, clientY: 50 },
          { clientX: 150, clientY: 50 }
        ])
      )
      canvas.dispatchEvent(
        createTouchEvent('touchmove', [
          { clientX: 40, clientY: 50 },
          { clientX: 180, clientY: 50 }
        ])
      )
      canvas.dispatchEvent(createTouchEvent('touchend', []))
    })

    // 3. Quick tap on building at grid (2, 2)
    act(() => {
      canvas.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 0, clientY: 70 }]))
      canvas.dispatchEvent(createTouchEvent('touchend', []))
    })

    expect(onSelectModel).toHaveBeenCalledWith('bp_sample')
    expect(hapticSpy).toHaveBeenCalledWith('light')
    act(() => {
      root.unmount()
    })
    container.remove()
  })
})
