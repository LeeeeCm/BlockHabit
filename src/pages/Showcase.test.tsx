import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Showcase from './Showcase'
import { blueprintOrder } from '../logic/blueprints'
import { useAppStore } from '../store/appStore'
import type { ShowcasePlacement } from '../types'

/**
 * D-20261111-068 自由装饰模式：展台页 jsdom 最小交互测试。
 * 画布渲染（ShowcaseScene）与拍立得用桩替换，只钉「解锁/开关/点击语义/旋转/换植被/不落盘」。
 */
const { sceneProps } = vi.hoisted(() => ({
  sceneProps: [] as Array<Record<string, unknown>>,
}))

// React 19 的 act 需要显式声明测试环境（与其它 jsdom 测试保持一致）
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../render/ShowcaseScene', () => ({
  ShowcaseScene: (props: Record<string, unknown>) => {
    sceneProps.push(props)
    const placements = (props.placements ?? []) as ShowcasePlacement[]
    const onSelectModel = props.onSelectModel as ((id: string) => void) | undefined
    return (
      <div data-testid="scene">
        {placements.map((p) => (
          <button
            key={p.blueprintId}
            data-testid={`tap-${p.blueprintId}`}
            onClick={() => onSelectModel?.(p.blueprintId)}
          >
            {p.blueprintId}
          </button>
        ))}
      </div>
    )
  },
}))

vi.mock('../components/PolaroidModal', () => ({
  PolaroidModal: (props: { blueprint: { id: string } }) => (
    <div data-testid="polaroid">{props.blueprint.id}</div>
  ),
}))

vi.mock('../components/GuideTip', () => ({ GuideTip: () => null }))

let root: Root | null = null
let container: HTMLDivElement | null = null

function seedStore(completed: string[], placements: ShowcasePlacement[]) {
  useAppStore.setState({
    completedBlueprintIds: completed,
    showcasePlacements: placements,
    settings: { ...useAppStore.getState().settings, language: 'zh', enableEcoProps: true },
  })
}

function renderShowcase(): HTMLDivElement {
  sceneProps.length = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<Showcase />)
  })
  return container
}

function findButton(target: HTMLDivElement, label: string): HTMLButtonElement {
  const hit = Array.from(target.querySelectorAll('button')).find(
    (b) => b.textContent?.includes(label) || b.getAttribute('aria-label') === label || b.title === label,
  )
  if (!hit) throw new Error(`button not found: ${label}`)
  return hit
}

function click(target: HTMLDivElement, label: string) {
  const button = findButton(target, label)
  act(() => button.click())
}

function latestSceneProps(): Record<string, unknown> {
  expect(sceneProps.length).toBeGreaterThan(0)
  return sceneProps[sceneProps.length - 1]
}

const allCompleted = () => [...blueprintOrder]

beforeEach(() => {
  sceneProps.length = 0
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  container?.remove()
  root = null
  container = null
  useAppStore.setState({ completedBlueprintIds: [], showcasePlacements: [] })
})

describe('Showcase 自由装饰模式（D-20261111-068）', () => {
  it('未全落成时零入口：没有「装饰模式」开关', () => {
    seedStore(blueprintOrder.slice(0, -1), [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()
    expect(view.textContent).not.toContain('装饰模式')
    expect(view.querySelector('[role="toolbar"]')).toBeNull()
  })

  it('全落成后出现开关（默认关闭），开启后显示模式提示与「换一组植被」', () => {
    seedStore(allCompleted(), [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()
    expect(view.textContent).toContain('装饰模式')
    // 默认关闭：画布 props 是默认值
    expect(latestSceneProps().rotations).toEqual({})
    expect(latestSceneProps().ecoSeed).toBe(0)
    expect(latestSceneProps().selectedId).toBeNull()

    click(view, '装饰模式')
    expect(view.textContent).toContain('退出装饰')
    expect(view.textContent).toContain('拖动摆位、旋转模型')
    expect(view.textContent).toContain('换一组植被')
    expect(view.querySelector('[role="toolbar"]')).not.toBeNull()
    expect(latestSceneProps().rotations).toEqual({})
    expect(latestSceneProps().ecoSeed).toBe(0)
  })

  it('装饰模式下点击模型 = 选中（不打开拍立得），显示旋转控件；退出后恢复点击看相纸', () => {
    seedStore(allCompleted(), [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()
    click(view, '装饰模式')
    click(view, 'plant')
    expect(view.querySelector('[data-testid="polaroid"]')).toBeNull()
    expect(view.textContent).toContain('绿意盆栽')
    expect(findButton(view, '逆时针旋转 90°')).toBeTruthy()
    expect(findButton(view, '顺时针旋转 90°')).toBeTruthy()
    expect(latestSceneProps().selectedId).toBe('plant')

    // 退出装饰：会话旋转/种子/选中全部复原；点击恢复拍立得
    click(view, '退出装饰')
    expect(latestSceneProps().selectedId).toBeNull()
    expect(latestSceneProps().rotations).toEqual({})
    expect(view.querySelector('[data-testid="polaroid"]')).toBeNull()
    click(view, 'plant')
    expect(view.querySelector('[data-testid="polaroid"]')).not.toBeNull()
  })

  it('旋转 90° 写入会话 rotations；越界/碰撞时提示 rotateBlocked 且不应用', () => {
    // robot 7×3 放在 (2,2)：旋转 90° 后 3×7 仍在 26 格内 → 允许
    seedStore(allCompleted(), [{ blueprintId: 'robot', gridX: 2, gridY: 2 }])
    const view = renderShowcase()
    click(view, '装饰模式')
    click(view, 'robot')
    click(view, '顺时针旋转 90°')
    expect(latestSceneProps().rotations).toEqual({ robot: 1 })
    // 再转 90°：180° 也合法
    click(view, '顺时针旋转 90°')
    expect(latestSceneProps().rotations).toEqual({ robot: 2 })
    // 转到 270° 后回到 0°，状态里不残留 key
    click(view, '顺时针旋转 90°')
    click(view, '顺时针旋转 90°')
    expect(latestSceneProps().rotations).toEqual({})

    // 越界：robot 7×3 贴底边 (0,23)，旋转 90° 后 3×7 会超出 26 格 → 拒绝并提示
    act(() => {
      useAppStore.setState({ showcasePlacements: [{ blueprintId: 'robot', gridX: 0, gridY: 23 }] })
    })
    // 选中态保留在 robot 上，直接旋转：贴底边转 90° 会越界
    click(view, '顺时针旋转 90°')
    expect(view.textContent).toContain('旋转后会与其他模型重叠，已还原')
    expect(latestSceneProps().rotations).toEqual({})
  })

  it('换一组植被：种子自增（确定性重排，仅会话）', () => {
    seedStore(allCompleted(), [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()
    click(view, '装饰模式')
    click(view, '换一组植被')
    expect(latestSceneProps().ecoSeed).toBe(1)
    expect(view.textContent).toContain('植被已重排（仅本次会话）')
    click(view, '换一组植被')
    expect(latestSceneProps().ecoSeed).toBe(2)
  })

  it('旋转/换植被不写存档：操作前后 exportData 深度相等', () => {
    seedStore(allCompleted(), [{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    const view = renderShowcase()
    const before = useAppStore.getState().exportData()
    click(view, '装饰模式')
    click(view, 'plant')
    click(view, '顺时针旋转 90°')
    click(view, '换一组植被')
    const after = useAppStore.getState().exportData()
    expect(after).toBe(before)
    // 会话态只在 React 子组件 props 上，不在 store 的持久化字段里
    expect(useAppStore.getState().showcasePlacements).toEqual([
      { blueprintId: 'plant', gridX: 2, gridY: 2 },
    ])
  })
})
