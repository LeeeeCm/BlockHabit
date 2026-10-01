import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getCubeSprite,
  clearCubeSpriteCache,
  drawCube,
  DEFAULT_ISO_CONFIG,
  type IsoConfig,
  type IsoPalette,
} from './iso'
const mockPalette: IsoPalette = {
  top: '#f4f4f4',
  left: '#c9c9c9',
  right: '#3d3d3d',
  ghost: 'rgba(255,255,255,0.4)',
  line: '#1c1917',
  accent: '#f59e0b',
  ink: '#1c1917',
}

describe('iso block sprite cache', () => {
  let origOffscreenCanvas: typeof globalThis.OffscreenCanvas

  beforeEach(() => {
    clearCubeSpriteCache()
    origOffscreenCanvas = globalThis.OffscreenCanvas

    // Mock OffscreenCanvas supporting 2D context
    globalThis.OffscreenCanvas = class MockOffscreenCanvas {
      width: number
      height: number
      constructor(w: number, h: number) {
        this.width = w
        this.height = h
      }
      getContext() {
        return {
          scale: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          clip: vi.fn(),
          beginPath: vi.fn(),
          closePath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          arcTo: vi.fn(),
          bezierCurveTo: vi.fn(),
          arc: vi.fn(),
          ellipse: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
          rect: vi.fn(),
          roundRect: vi.fn(),
          setTransform: vi.fn(),
          clearRect: vi.fn(),
          drawImage: vi.fn(),
        }
      }
    } as unknown as typeof globalThis.OffscreenCanvas
  })

  afterEach(() => {
    globalThis.OffscreenCanvas = origOffscreenCanvas
    clearCubeSpriteCache()
  })

  it('renders and caches sprite on first request, hits cache on repeat', () => {
    const c: IsoConfig = DEFAULT_ISO_CONFIG
    const sprite1 = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 2)
    expect(sprite1).not.toBeNull()
    expect(sprite1?.width).toBeGreaterThan(0)
    expect(sprite1?.height).toBeGreaterThan(0)
    expect(sprite1?.anchorX).toBeGreaterThan(0)
    expect(sprite1?.anchorY).toBeGreaterThan(0)

    // Repeat with identical arguments returns same cached instance
    const sprite2 = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 2)
    expect(sprite2).toBe(sprite1)
  })

  it('generates different cache entries for distinct colors, types, or stud settings', () => {
    const c: IsoConfig = DEFAULT_ISO_CONFIG
    const sColorA = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 2)
    const sColorB = getCubeSprite('#ef4444', 'basic', false, c, mockPalette, 2)
    const sNoStuds = getCubeSprite('#3b82f6', 'basic', true, c, mockPalette, 2)
    const sWindow = getCubeSprite('#3b82f6', 'window', false, c, mockPalette, 2)

    expect(sColorA).not.toBe(sColorB)
    expect(sColorA).not.toBe(sNoStuds)
    expect(sColorA).not.toBe(sWindow)
  })

  it('clears all cached sprites on clearCubeSpriteCache()', () => {
    const c: IsoConfig = DEFAULT_ISO_CONFIG
    const s1 = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 2)
    expect(s1).not.toBeNull()

    clearCubeSpriteCache()

    const s2 = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 2)
    expect(s2).not.toBe(s1)
  })

  it('treats dpr as a distinct cache dimension (2x bitmap for 2x sprites)', () => {
    const c: IsoConfig = DEFAULT_ISO_CONFIG
    const s1 = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 1)
    const s1Again = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 1)
    const s2 = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 2)
    expect(s1Again).toBe(s1)
    expect(s2).not.toBe(s1)
    // 位图密度随 dpr 翻倍（CSS 逻辑尺寸不变）
    expect(s2!.canvas.width).toBeCloseTo((s1!.canvas.width) * 2)
  })

  it('treats palette as a distinct cache dimension (theme switch does not cross-contaminate)', () => {
    const c: IsoConfig = DEFAULT_ISO_CONFIG
    const light = getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 2)
    const darkPalette: IsoPalette = {
      ...mockPalette,
      top: '#27272a',
      left: '#3f3f46',
      right: '#18181b',
      ink: '#fafafa',
    }
    const dark = getCubeSprite('#3b82f6', 'basic', false, c, darkPalette, 2)
    expect(dark).not.toBe(light)
    // 两种 palette 的缓存并存，互不失效
    expect(getCubeSprite('#3b82f6', 'basic', false, c, mockPalette, 2)).toBe(light)
  })

  it('evicts the oldest entry beyond the 512 cap (FIFO)', () => {
    const c: IsoConfig = DEFAULT_ISO_CONFIG
    const first = getCubeSprite('#evict-000', 'basic', false, c, mockPalette, 2)
    // 灌入 512 个新 key：总插入 513 次，最早条目（#evict-000）被淘汰
    for (let i = 0; i < 512; i++) {
      getCubeSprite(`#evict-${i}`, 'basic', false, c, mockPalette, 2)
    }
    const firstAgain = getCubeSprite('#evict-000', 'basic', false, c, mockPalette, 2)
    expect(firstAgain).not.toBe(first)
    // 最近条目仍在缓存（命中不重新生成）
    const last = getCubeSprite('#evict-511', 'basic', false, c, mockPalette, 2)
    expect(getCubeSprite('#evict-511', 'basic', false, c, mockPalette, 2)).toBe(last)
  })

  it('drawCube invokes drawImage when sprite is cached', () => {
    const drawImageSpy = vi.fn()
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: drawImageSpy,
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      clip: vi.fn(),
      roundRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    drawCube(mockCtx, 100, 100, DEFAULT_ISO_CONFIG, mockPalette, {
      color: '#3b82f6',
      type: 'basic',
    })

    expect(drawImageSpy).toHaveBeenCalledTimes(1)
  })

  it('supports vector overlay layers (bonus, highlight, starred, hasNote) on top of cached sprite', () => {
    const drawImageSpy = vi.fn()
    const strokeSpy = vi.fn()
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: drawImageSpy,
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      stroke: strokeSpy,
      fill: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      clip: vi.fn(),
      roundRect: vi.fn(),
      ellipse: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    drawCube(mockCtx, 100, 100, DEFAULT_ISO_CONFIG, mockPalette, {
      color: '#3b82f6',
      type: 'basic',
      bonus: true,
      starred: true,
      hasNote: true,
      highlight: true,
    })

    // Base sprite is drawn
    expect(drawImageSpy).toHaveBeenCalledTimes(1)
    // Dynamic overlay strokes are drawn on top
    expect(strokeSpy).toHaveBeenCalled()
  })

  it('falls back to direct vector draw when canvas/OffscreenCanvas is unavailable', () => {
    globalThis.OffscreenCanvas = undefined as unknown as typeof globalThis.OffscreenCanvas
    const origCreateElement = document.createElement
    // @ts-expect-error test mock
    document.createElement = undefined

    try {
      const fillSpy = vi.fn()
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arcTo: vi.fn(),
        rect: vi.fn(),
        ellipse: vi.fn(),
        stroke: vi.fn(),
        fill: fillSpy,
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        clip: vi.fn(),
        roundRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D

      expect(() => {
        drawCube(mockCtx, 100, 100, DEFAULT_ISO_CONFIG, mockPalette, {
          color: '#3b82f6',
          type: 'basic',
        })
      }).not.toThrow()

      // Vector gradient paths are filled directly
      expect(fillSpy).toHaveBeenCalled()
    } finally {
      document.createElement = origCreateElement
    }
  })
})
