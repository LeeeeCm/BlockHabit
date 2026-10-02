import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BuildScene } from './BuildScene'
import { useAppStore } from '../store/appStore'
import { getBlueprint } from '../logic/blueprints'
import { clearCubeSpriteCache } from './iso'
import type { Habit } from '../types'

/**
 * 组件级集成测试：BuildScene 的微生态彩蛋链路
 * （store → ecoStage memo → drawGroundBounds → 迷你植被精灵绘制）
 * 迷你植被精灵宽 24px（mini cfg tileW=16），主积木精灵宽 56px——用 drawImage
 * 参数区分两者。
 */

const daily: Habit = {
  id: 'h1',
  name: '读书',
  frequency: { type: 'daily' },
  createdAt: '2026-08-01T00:00:00.000Z',
}

describe('BuildScene 微生态彩蛋链路', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null = null
  let drawImages: Array<{ w: number; h: number }>
  let ctxStub: Record<string, unknown>

  beforeEach(() => {
    clearCubeSpriteCache()
    drawImages = []
    ctxStub = {
      save: vi.fn(), restore: vi.fn(), scale: vi.fn(), setTransform: vi.fn(),
      clearRect: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
      beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      arcTo: vi.fn(), bezierCurveTo: vi.fn(), arc: vi.fn(), ellipse: vi.fn(),
      stroke: vi.fn(), fill: vi.fn(), clip: vi.fn(), rect: vi.fn(), roundRect: vi.fn(),
      fillRect: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
      putImageData: vi.fn(),
      drawImage: vi.fn((img: { width: number; height: number }) => {
        drawImages.push({ w: img.width, h: img.height })
      }),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    }

    // OffscreenCanvas mock（精灵绘制介质）
    vi.stubGlobal('OffscreenCanvas', class {
      width: number
      height: number
      constructor(w: number, h: number) { this.width = w; this.height = h }
      getContext() { return ctxStub }
    })

    // ResizeObserver mock
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    // matchMedia mock（含事件方法）
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    // BuildScene 渲染自己的 canvas：jsdom 中 clientWidth=0 会让 resize() 提前返回、
    // draw 永不执行——在 prototype 上 stub 尺寸与 2d 上下文
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, value: 800 })
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ctxStub),
    })

    container = document.createElement('div')
    document.body.appendChild(container)

    const today = new Date()
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const blocks = getBlueprint('plant').blocks
    useAppStore.setState({
      habits: [daily],
      checkIns: [{ id: 'c1', habitId: 'h1', date: day, at: `${day}T12:00:00.000Z`, placedBlockId: 'b0', blueprintId: 'plant' }],
      builds: blocks.slice(0, 1).map((b, i) => ({
        id: 'b0', blueprintId: 'plant', index: i,
        placedAt: `${day}T12:00:00.000Z`, fromHabitId: 'h1', bonus: false,
        x: b.x, y: b.y, z: b.z, type: b.type, color: b.color,
      })),
      activeBlueprintId: 'plant',
      settings: { theme: 'light', language: 'zh', enableEcoProps: true, enableAmbientLighting: true, enableGyroscope: false, enableXRayInspection: false },
    })
  })

  afterEach(() => {
    act(() => { root?.unmount() })
    root = null
    container.remove()
    vi.unstubAllGlobals()
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, value: 0 })
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, value: 0 })
    delete (HTMLCanvasElement.prototype as unknown as { getContext?: unknown }).getContext
    clearCubeSpriteCache()
  })

  async function renderBuild(ecoProps: boolean) {
    useAppStore.setState({ settings: { theme: 'light', language: 'zh', enableEcoProps: ecoProps, enableAmbientLighting: true, enableGyroscope: false, enableXRayInspection: false } })
    const blueprint = getBlueprint('plant')
    const placedCount = useAppStore.getState().builds.length
    await act(async () => {
      root = createRoot(container)
      root.render(<BuildScene blueprint={blueprint} placedCount={placedCount} />)
      await new Promise((r) => setTimeout(r, 80))
    })
  }

  it('eco stage 1: mini flora sprites (24px) flow through the draw pipeline', async () => {
    await renderBuild(true)
    const miniSprites = drawImages.filter((d) => d.w === 24 && d.h === 28)
    console.log('[test-dbg] drawImages:', JSON.stringify(drawImages.slice(0, 6)), 'total:', drawImages.length)
    expect(miniSprites.length).toBeGreaterThanOrEqual(4) // 阶段 1：四角灌木
  })

  it('eco disabled: no mini flora sprites drawn', async () => {
    await renderBuild(false)
    const miniSprites = drawImages.filter((d) => d.w === 24 && d.h === 28)
    expect(miniSprites.length).toBe(0)
  })
})
