import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Showcase from './Showcase'
import { useAppStore } from '../store/appStore'
import type { ShowcasePlacement, ShowcaseSandbox } from '../types'

/**
 * D-20261127-127 展台页交互：
 * 多沙盘左抽屉、堆场右抽屉、右键旋转/收拢、跨沙盘移动、删除沙盘。
 * 画布、缩略图、拍立得与确认框用桩替换，只钉页面编排与持久化结果。
 */
const { sceneProps } = vi.hoisted(() => ({
  sceneProps: [] as Array<Record<string, unknown>>
}))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../render/ShowcaseScene', () => ({
  ShowcaseScene: (props: Record<string, unknown>) => {
    sceneProps.push(props)
    const placements = (props.placements ?? []) as ShowcasePlacement[]
    const onSelectModel = props.onSelectModel as ((id: string) => void) | undefined
    const onModelContextMenu =
      (props.onModelContextMenu as ((id: string, x: number, y: number) => void) | undefined) ??
      undefined
    return (
      <div data-testid="scene">
        {placements.map((p) => (
          <div key={p.blueprintId}>
            <button
              data-testid={`tap-${p.blueprintId}`}
              onClick={() => onSelectModel?.(p.blueprintId)}
            >
              {p.blueprintId}
            </button>
            <button
              data-testid={`ctx-${p.blueprintId}`}
              onClick={() => onModelContextMenu?.(p.blueprintId, 120, 120)}
            >
              ctx
            </button>
          </div>
        ))}
      </div>
    )
  }
}))

vi.mock('../components/PolaroidModal', () => ({
  PolaroidModal: (props: { blueprint: { id: string } }) => (
    <div data-testid="polaroid">{props.blueprint.id}</div>
  )
}))

vi.mock('../components/GuideTip', () => ({ GuideTip: () => null }))

vi.mock('../components/BlueprintThumb', () => ({
  BlueprintThumb: (props: { blueprint: { id: string } }) => (
    <div data-testid={`thumb-${props.blueprint.id}`} />
  )
}))

vi.mock('../components/ConfirmDialog', () => ({
  ConfirmDialog: (props: {
    title: string
    message: string
    onConfirm: () => void
    onCancel: () => void
  }) => (
    <div data-testid="confirm-sandbox">
      <span>{props.title}</span>
      <span>{props.message}</span>
      <button onClick={props.onConfirm}>确认删除</button>
      <button onClick={props.onCancel}>取消</button>
    </div>
  )
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

function resetStore() {
  useAppStore.setState({
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { ...useAppStore.getState().settings, language: 'zh', theme: 'light' },
    dayClaims: [],
    deletedDayClaims: [],
    showcasePlacements: [],
    showcaseSandboxes: undefined,
    activeSandboxId: undefined
  })
}

interface SeedOptions {
  sandboxes?: ShowcaseSandbox[]
  activeId?: string
}

function seedStore(
  completed: string[],
  placements: ShowcasePlacement[],
  options: SeedOptions = {}
) {
  useAppStore.setState({
    completedBlueprintIds: completed,
    showcasePlacements: placements,
    showcaseSandboxes: options.sandboxes,
    activeSandboxId: options.activeId
  })
}

function renderShowcase(): HTMLDivElement {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(<Showcase />)
  })
  return container
}

function click(target: HTMLElement, label: string) {
  const button = findButton(target, label)
  act(() => button.click())
}

function findButton(target: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(target.querySelectorAll('button')).find((el) =>
    (el.textContent ?? '').includes(label)
  )
  if (!button) throw new Error(`button not found: ${label}`)
  return button as HTMLButtonElement
}

function latestSceneProps(): Record<string, unknown> {
  expect(sceneProps.length).toBeGreaterThan(0)
  return sceneProps[sceneProps.length - 1]
}

function placementsOfStore(): ShowcasePlacement[] {
  return useAppStore.getState().showcasePlacements ?? []
}

beforeEach(() => {
  sceneProps.length = 0
  resetStore()
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  container?.remove()
  root = null
  container = null
})

describe('展台多沙盘（D-20261127-127）', () => {
  it('默认一个沙盘、左右抽屉收起；不再出现装饰模式', () => {
    seedStore(['plant'], [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()

    expect(view.textContent).not.toContain('装饰模式')
    expect(view.textContent).toContain('沙盘')
    expect(view.textContent).toContain('堆场')
    expect(
      view.querySelector('.sc-drawer-left .sc-drawer-tab')?.getAttribute('aria-expanded')
    ).toBe('false')
    expect(latestSceneProps().design).toBe('moss')
    expect(latestSceneProps().viewFitKey).toBe('sandbox-1')
    expect(latestSceneProps().placements).toEqual([{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
  })

  it('左抽屉新建沙盘：立即切换、空布局、自动轮换颜色', () => {
    seedStore(['plant'], [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()

    const leftTab = view.querySelector('.sc-drawer-left .sc-drawer-tab') as HTMLButtonElement
    act(() => leftTab.click())
    expect(leftTab.getAttribute('aria-expanded')).toBe('true')
    click(view, '新建沙盘')

    const state = useAppStore.getState()
    expect(state.showcaseSandboxes?.length).toBe(2)
    expect(state.activeSandboxId).not.toBe('sandbox-1')
    expect(state.activeSandboxId).toBe(state.showcaseSandboxes?.[1].id)
    expect(latestSceneProps().placements).toEqual([])
    expect(latestSceneProps().design).toBe('stone')
    expect(latestSceneProps().viewFitKey).toBe(state.activeSandboxId)
  })

  it('切换沙盘：画布 placements 跟随对应沙盘', () => {
    seedStore(['plant', 'coffee'], [], {
      sandboxes: [
        {
          id: 'sandbox-1',
          placements: [{ blueprintId: 'plant', gridX: 1, gridY: 1 }],
          design: 'moss'
        },
        {
          id: 'sandbox-2',
          placements: [{ blueprintId: 'coffee', gridX: 2, gridY: 2 }],
          design: 'bloom'
        }
      ],
      activeId: 'sandbox-1'
    })
    const view = renderShowcase()
    expect(latestSceneProps().placements).toEqual([{ blueprintId: 'plant', gridX: 1, gridY: 1 }])

    const leftTab = view.querySelector('.sc-drawer-left .sc-drawer-tab') as HTMLButtonElement
    act(() => leftTab.click())
    const sandboxTwo = Array.from(view.querySelectorAll('.sc-sandbox-main')).find((el) =>
      (el.textContent ?? '').includes('沙盘 2')
    ) as HTMLButtonElement
    act(() => sandboxTwo.click())

    expect(useAppStore.getState().activeSandboxId).toBe('sandbox-2')
    expect(latestSceneProps().placements).toEqual([{ blueprintId: 'coffee', gridX: 2, gridY: 2 }])
    expect(latestSceneProps().design).toBe('bloom')
  })

  it('沙盘设计切换写入存档，并传给画布', () => {
    seedStore(['plant'], [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()
    const leftTab = view.querySelector('.sc-drawer-left .sc-drawer-tab') as HTMLButtonElement
    act(() => leftTab.click())
    const chip = Array.from(view.querySelectorAll('.sc-design-chip')).find((el) =>
      (el.textContent ?? '').includes('石白')
    ) as HTMLButtonElement
    act(() => chip.click())

    expect(latestSceneProps().design).toBe('stone')
    expect(useAppStore.getState().showcaseSandboxes?.[0].design).toBe('stone')
  })

  it('右键菜单：旋转写入 placement.rotation；收拢后建筑出现在堆场', () => {
    seedStore(['plant'], [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()

    act(() => (view.querySelector('[data-testid="ctx-plant"]') as HTMLButtonElement).click())
    expect(document.querySelector('.sc-ctx')).not.toBeNull()
    click(document.body, '旋转 90°')
    expect(placementsOfStore()).toEqual([{ blueprintId: 'plant', gridX: 2, gridY: 2, rotation: 1 }])

    act(() => (view.querySelector('[data-testid="ctx-plant"]') as HTMLButtonElement).click())
    click(document.body, '收拢回堆场')
    expect(placementsOfStore()).toEqual([])
    expect(view.textContent).toContain('已收拢回堆场')

    const rightTab = view.querySelector('.sc-drawer-right .sc-drawer-tab') as HTMLButtonElement
    act(() => rightTab.click())
    expect(view.textContent).toContain('绿意盆栽')
  })

  it('堆场点击建筑：放上当前沙盘并持久化', () => {
    seedStore(['plant'], [])
    const view = renderShowcase()
    const rightTab = view.querySelector('.sc-drawer-right .sc-drawer-tab') as HTMLButtonElement
    act(() => rightTab.click())
    const row = view.querySelector('.sc-yard-row') as HTMLButtonElement
    expect(row.textContent).toContain('绿意盆栽')
    act(() => row.click())

    const stored = placementsOfStore()
    expect(stored.length).toBe(1)
    expect(stored[0].blueprintId).toBe('plant')
    expect(latestSceneProps().placements).toEqual(stored)
    expect(view.textContent).toContain('「绿意盆栽」已陈列')
  })

  it('其他沙盘的建筑单独分组，点击移动到当前沙盘', () => {
    seedStore(['plant'], [], {
      sandboxes: [
        {
          id: 'sandbox-1',
          placements: [{ blueprintId: 'plant', gridX: 2, gridY: 2 }],
          design: 'moss'
        },
        { id: 'sandbox-2', placements: [], design: 'stone' }
      ],
      activeId: 'sandbox-2'
    })
    const view = renderShowcase()
    const rightTab = view.querySelector('.sc-drawer-right .sc-drawer-tab') as HTMLButtonElement
    act(() => rightTab.click())
    expect(view.textContent).toContain('在其他沙盘')
    expect(view.textContent).toContain('沙盘 1')

    const row = view.querySelector('.sc-yard-row') as HTMLButtonElement
    act(() => row.click())

    const sandboxes = useAppStore.getState().showcaseSandboxes ?? []
    expect(sandboxes[0].placements).toEqual([])
    expect(sandboxes[1].placements.length).toBe(1)
    expect(sandboxes[1].placements[0].blueprintId).toBe('plant')
  })

  it('删除沙盘：确认后移除，建筑回到堆场（不删建筑）', () => {
    seedStore(['plant'], [], {
      sandboxes: [
        {
          id: 'sandbox-1',
          placements: [{ blueprintId: 'plant', gridX: 2, gridY: 2 }],
          design: 'moss'
        },
        { id: 'sandbox-2', placements: [], design: 'stone' }
      ],
      activeId: 'sandbox-2'
    })
    const view = renderShowcase()
    const leftTab = view.querySelector('.sc-drawer-left .sc-drawer-tab') as HTMLButtonElement
    act(() => leftTab.click())
    const removeButton = Array.from(view.querySelectorAll('button')).find((el) =>
      (el.getAttribute('aria-label') ?? '').includes('删除沙盘 沙盘 1')
    ) as HTMLButtonElement
    act(() => removeButton.click())
    expect(view.querySelector('[data-testid="confirm-sandbox"]')).not.toBeNull()
    click(view, '确认删除')

    const state = useAppStore.getState()
    expect(state.showcaseSandboxes?.length).toBe(1)
    expect(state.completedBlueprintIds).toEqual(['plant'])
    const rightTab = view.querySelector('.sc-drawer-right .sc-drawer-tab') as HTMLButtonElement
    act(() => rightTab.click())
    expect(view.textContent).toContain('绿意盆栽')
  })

  it('自动排列只重排当前沙盘已有的陈列', () => {
    seedStore(['plant', 'coffee'], [{ blueprintId: 'plant', gridX: 0, gridY: 0 }])
    const view = renderShowcase()
    click(view, '自动排列')
    const stored = placementsOfStore()
    expect(stored.map((p) => p.blueprintId)).toEqual(['plant'])
    expect(latestSceneProps().placements).toEqual(stored)
  })
})
