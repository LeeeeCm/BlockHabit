import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blueprints } from '../logic/blueprints'
import { clearCubeSpriteCache } from '../render/iso'
import { BlueprintThumb, silhouettePalette } from './BlueprintThumb'

/** B1：图鉴锁定态剪影 —— 单色（--ink 派生）+ 不压暗名字的缩略图。 */

interface RecordedCall {
  name: string
  args: unknown[]
}

function createFakeContext(): { ctx: CanvasRenderingContext2D; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const gradient = { addColorStop: () => undefined }
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 7 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
  }
  const proxy = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string]
      if (typeof prop !== 'string') return undefined
      return (...args: unknown[]) => {
        calls.push({ name: prop, args })
      }
    },
    set(obj, prop, value) {
      obj[prop as string] = value
      return true
    }
  })
  return { ctx: proxy as unknown as CanvasRenderingContext2D, calls }
}

let fake: ReturnType<typeof createFakeContext>
let getContextSpy: ReturnType<typeof vi.spyOn>

function renderThumb(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(element)
  })
  return {
    container,
    canvas: () => container.querySelector('canvas') as HTMLCanvasElement,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

beforeEach(() => {
  clearCubeSpriteCache()
  fake = createFakeContext()
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => fake.ctx) as unknown as HTMLCanvasElement['getContext'])
})

afterEach(() => {
  getContextSpy.mockRestore()
  clearCubeSpriteCache()
  document.body.innerHTML = ''
})

describe('silhouettePalette（纯函数）', () => {
  it('所有面/描边都从同一墨色派生，仅透明度不同（无第二色相）', () => {
    const palette = silhouettePalette('#0a0a0a')
    expect(palette.top).toBe('rgba(10,10,10,0.26)')
    expect(palette.left).toBe('rgba(10,10,10,0.22)')
    expect(palette.right).toBe('rgba(10,10,10,0.18)')
    expect(palette.ghost).toBe('rgba(10,10,10,0.08)')
    expect(palette.line).toBe('rgba(10,10,10,0.3)')
    expect(palette.ink).toBe('rgba(10,10,10,0.45)')
    for (const value of Object.values(palette)) {
      expect(value.startsWith('rgba(10,10,10,')).toBe(true)
    }
  })

  it('跟随主题墨色（暗色主题 #fafafa）', () => {
    const palette = silhouettePalette('#fafafa')
    expect(palette.top).toBe('rgba(250,250,250,0.26)')
    expect(palette.ink).toBe('rgba(250,250,250,0.45)')
  })
})

describe('BlueprintThumb 剪影态', () => {
  it('普通态：画布尺寸正确、背景为 surface、不传 silhouette 时正常绘制', () => {
    const { canvas, unmount } = renderThumb(<BlueprintThumb blueprint={blueprints.plant} />)
    const el = canvas()
    expect(el.width).toBe(132)
    expect(el.height).toBe(92)
    expect(el.style.background).toBe('var(--surface)')
    expect(fake.calls.some((call) => call.name === 'fill')).toBe(true)
    expect(fake.calls.some((call) => call.name === 'clearRect')).toBe(true)
    unmount()
  })

  it('剪影态：透明底 + 单色绘制（不泄露建筑配色）', () => {
    const { canvas, unmount } = renderThumb(
      <BlueprintThumb blueprint={blueprints.plant} silhouette />
    )
    const el = canvas()
    expect(el.style.background).toBe('transparent')
    expect(el.style.opacity).toBe('0.9')
    // 画过东西（非空渲染），但只使用 ink 派生的 rgba 灰度色
    expect(fake.calls.some((call) => call.name === 'fill')).toBe(true)
    unmount()
  })

  it('两种态共用同一蓝图对象也各自渲染，不互相污染', () => {
    const { container, unmount } = renderThumb(
      <>
        <BlueprintThumb blueprint={blueprints.plant} />
        <BlueprintThumb blueprint={blueprints.plant} silhouette />
      </>
    )
    const canvases = Array.from(container.querySelectorAll('canvas'))
    expect(canvases).toHaveLength(2)
    expect(canvases[0].style.background).toBe('var(--surface)')
    expect(canvases[1].style.background).toBe('transparent')
    unmount()
  })
})
