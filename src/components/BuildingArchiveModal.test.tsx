import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlacedBlock } from '../types'
import { BuildingArchiveModal } from './BuildingArchiveModal'
import { blueprints } from '../logic/blueprints'
import { useAppStore } from '../store/appStore'
import { zh } from '../i18n/locales/zh'
import * as detectModule from '../platform/detect'

/**
 * 建筑档案卡弹层（B5 收尾）：
 * - 桌面端仍是 overlay/dialog（原行为不回归）；
 * - 移动端（usePlatform.isMobile）改用 BottomSheet，标题/底栏保留、Esc 可关；
 * - 舞台 canvas 带 data-testid="archive-stage"，供自动化断言；
 * - 嵌套拍立得在移动端被抬到抽屉之上（stacking wrapper），Esc 逐层关闭。
 */

function createFakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined }
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: String(text).length * 7 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }),
  }
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string]
      if (typeof prop !== 'string') return undefined
      return () => undefined
    },
    set(obj, prop, value) {
      obj[prop as string] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

function atLocal(date: string, hour = 12): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0).toISOString()
}

function plantBuilds(): PlacedBlock[] {
  return blueprints.plant.blocks.map((_, index) => ({
    id: 'plant-' + index,
    blueprintId: 'plant',
    index,
    placedAt: atLocal('2026-03-0' + (index + 1)),
    fromHabitId: 'h1',
    bonus: false,
  }))
}

function seedCompletedPlant(): void {
  const current = useAppStore.getState()
  useAppStore.setState({
    builds: plantBuilds(),
    checkIns: [],
    habits: [{ id: 'h1', name: '晨间冥想', frequency: { type: 'daily' }, createdAt: '2024-01-01T00:00:00.000Z' }],
    foundationNotes: {},
    completedBlueprintIds: ['plant'],
    settings: { ...current.settings, language: 'zh' },
  })
}

function renderModal(onClose: () => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<BuildingArchiveModal blueprintId="plant" onClose={onClose} />)
  })
  return {
    container,
    query: (selector: string) => container.querySelector(selector) as HTMLElement | null,
    queryAll: (selector: string) => Array.from(container.querySelectorAll<HTMLElement>(selector)),
    text: () => container.textContent ?? '',
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

function pressEscape(): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
}

let getContextSpy: ReturnType<typeof vi.spyOn>
let detectSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  seedCompletedPlant()
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => createFakeContext()) as unknown as HTMLCanvasElement['getContext'])
  detectSpy = vi.spyOn(detectModule, 'detectPlatform').mockReturnValue('desktop')
})

afterEach(() => {
  detectSpy.mockRestore()
  getContextSpy.mockRestore()
  document.body.innerHTML = ''
})

describe('桌面端（行为不回归）', () => {
  it('仍是 overlay/dialog：标题、舞台 data-testid、底栏按钮都在；无 BottomSheet', () => {
    const view = renderModal(() => {})
    expect(view.query('#building-archive-title')?.textContent).toContain(zh.buildingArchive.title)
    expect(view.query('.overlay .dialog')).not.toBeNull()
    expect(view.query('[data-testid="archive-stage"]')).not.toBeNull()
    expect(view.query('[data-testid="bottom-sheet-handle"]')).toBeNull()
    expect(view.text()).toContain(zh.buildingArchive.polaroid)
    expect(view.text()).toContain(zh.buildingArchive.savePng)
    expect(view.text()).toContain(zh.buildingArchive.close)
    view.unmount()
  })

  it('Esc 关闭（useDialogA11y）', () => {
    const onClose = vi.fn()
    const view = renderModal(onClose)
    pressEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('未落成建筑：诚实空态，不渲染舞台 canvas', () => {
    useAppStore.setState({ builds: [] })
    const view = renderModal(() => {})
    expect(view.text()).toContain(zh.buildingArchive.empty)
    expect(view.query('[data-testid="archive-stage"]')).toBeNull()
    view.unmount()
  })
})

describe('移动端 BottomSheet', () => {
  beforeEach(() => {
    detectSpy.mockReturnValue('mobile')
  })

  it('改用 BottomSheet：标题/底栏保留，舞台 data-testid 仍在，无 overlay dialog', () => {
    const view = renderModal(() => {})
    expect(view.query('[data-testid="bottom-sheet-handle"]')).not.toBeNull()
    expect(view.query('[data-testid="bottom-sheet-close"]')).not.toBeNull()
    expect(view.query('.overlay .dialog')).toBeNull()
    expect(view.query('[data-testid="archive-stage"]')).not.toBeNull()
    expect(view.text()).toContain(zh.buildingArchive.title)
    expect(view.text()).toContain(zh.buildingArchive.polaroid)
    expect(view.text()).toContain(zh.buildingArchive.savePng)
    expect(view.text()).toContain(zh.buildingArchive.close)
    view.unmount()
  })

  it('Esc 关闭抽屉（BottomSheet 自身 Esc 行为）', () => {
    const onClose = vi.fn()
    const view = renderModal(onClose)
    pressEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('嵌套拍立得：抬到抽屉之上（z-index 1001 wrapper），Esc 逐层关闭不误关抽屉', () => {
    const onClose = vi.fn()
    const view = renderModal(onClose)

    const polaroidButton = view
      .queryAll('button')
      .find((button) => button.textContent?.trim() === zh.buildingArchive.polaroid)
    expect(polaroidButton).toBeDefined()
    act(() => {
      polaroidButton!.click()
    })

    const polaroid = view.query('[role="dialog"][aria-label]') as HTMLElement | null
    expect(polaroid).not.toBeNull()
    expect(polaroid!.getAttribute('aria-label')).toBe(zh.polaroid.modalTitle)
    // stacking wrapper 把拍立得抬到 BottomSheet（z-index 1000）之上
    expect(polaroid!.parentElement?.style.zIndex).toBe('1001')
    expect(polaroid!.parentElement?.style.position).toBe('relative')

    // 第一次 Esc：只关拍立得，抽屉仍在、onClose 不被调用（BottomSheet escEnabled=false）
    pressEscape()
    expect(onClose).not.toHaveBeenCalled()
    expect(view.query('[role="dialog"][aria-label]')).toBeNull()
    expect(view.query('[data-testid="bottom-sheet-handle"]')).not.toBeNull()

    // 第二次 Esc：抽屉正常关闭
    pressEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('移动端未落成建筑同样走诚实空态', () => {
    useAppStore.setState({ builds: [] })
    const view = renderModal(() => {})
    expect(view.text()).toContain(zh.buildingArchive.empty)
    expect(view.query('[data-testid="archive-stage"]')).toBeNull()
    view.unmount()
  })
})
