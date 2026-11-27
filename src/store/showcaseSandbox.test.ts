import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'
import { resolveShowcaseState } from '../logic/showcaseState'
import type { ShowcaseSandbox } from '../types'

/**
 * D-20261127-127 多沙盘 store 行为：
 * 旧档迁移、新增/切换/删除、底座颜色、旋转/收拢/陈列/自动排列与持久化。
 */

function resetStore(overrides: Partial<ReturnType<typeof useAppStore.getState>> = {}) {
  useAppStore.setState({
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    deletedDayClaims: [],
    showcasePlacements: [],
    showcaseSandboxes: undefined,
    activeSandboxId: undefined,
    ...overrides
  })
}

function sandboxes(): ShowcaseSandbox[] {
  return useAppStore.getState().showcaseSandboxes ?? []
}

function seedSandboxes(list: ShowcaseSandbox[], activeId: string) {
  resetStore({
    showcaseSandboxes: list,
    activeSandboxId: activeId,
    showcasePlacements: list.find((s) => s.id === activeId)?.placements ?? [],
    completedBlueprintIds: ['plant', 'coffee']
  })
}

const baseSandbox = (id: string, design: ShowcaseSandbox['design'] = 'moss'): ShowcaseSandbox => ({
  id,
  placements: [],
  design
})

describe('多沙盘 store（D-20261127-127）', () => {
  beforeEach(() => {
    resetStore()
  })

  it('只有 legacy showcasePlacements 时解析为 sandbox-1（moss）', () => {
    resetStore({
      showcasePlacements: [{ blueprintId: 'plant', gridX: 2, gridY: 2 }]
    })
    const resolved = resolveShowcaseState(useAppStore.getState())
    expect(resolved.activeId).toBe('sandbox-1')
    expect(resolved.sandboxes.length).toBe(1)
    expect(resolved.active.placements).toEqual([{ blueprintId: 'plant', gridX: 2, gridY: 2 }])
    expect(resolved.active.design).toBe('moss')
  })

  it('新增沙盘立即切换、自动轮换颜色；上限 4 个', () => {
    const first = useAppStore.getState().addShowcaseSandbox()
    expect(first).toBeTruthy()
    expect(first).not.toBe('sandbox-1')
    expect(useAppStore.getState().activeSandboxId).toBe(first)
    expect(sandboxes()[1].design).toBe('stone')

    expect(useAppStore.getState().addShowcaseSandbox()).toBeTruthy()
    expect(useAppStore.getState().addShowcaseSandbox()).toBeTruthy()
    expect(useAppStore.getState().addShowcaseSandbox()).toBeNull()
    expect(sandboxes().length).toBe(4)
    // id 全局唯一，不依赖顺序号（多设备离线新建不会撞号）
    expect(new Set(sandboxes().map((s) => s.id)).size).toBe(4)
  })

  it('切换 / 删除沙盘：删除当前沙盘回落到第一个；最后一个不可删', () => {
    seedSandboxes(
      [
        { ...baseSandbox('sandbox-1'), placements: [{ blueprintId: 'plant', gridX: 1, gridY: 1 }] },
        baseSandbox('sandbox-2', 'stone')
      ],
      'sandbox-2'
    )
    expect(useAppStore.getState().switchShowcaseSandbox('sandbox-1')).toBe(true)
    expect(useAppStore.getState().showcasePlacements).toEqual([
      { blueprintId: 'plant', gridX: 1, gridY: 1 }
    ])
    expect(useAppStore.getState().switchShowcaseSandbox('ghost')).toBe(false)

    expect(useAppStore.getState().removeShowcaseSandbox('sandbox-2')).toBe(true)
    expect(sandboxes().length).toBe(1)
    expect(useAppStore.getState().removeShowcaseSandbox('sandbox-1')).toBe(false)
  })

  it('颜色方案写入当前沙盘；未知值回落 moss', () => {
    seedSandboxes([baseSandbox('sandbox-1')], 'sandbox-1')
    expect(useAppStore.getState().setShowcaseSandboxDesign('sandbox-1', 'bloom')).toBe(true)
    expect(sandboxes()[0].design).toBe('bloom')
    // @ts-expect-error 运行时脏数据防御
    useAppStore.getState().setShowcaseSandboxDesign('sandbox-1', 'unknown')
    expect(sandboxes()[0].design).toBe('moss')
  })

  it('旋转持久化：90° 写入 rotation，转满一圈回落到无字段；越界拒绝', () => {
    seedSandboxes(
      [
        {
          ...baseSandbox('sandbox-1'),
          placements: [{ blueprintId: 'plant', gridX: 2, gridY: 2 }]
        }
      ],
      'sandbox-1'
    )
    expect(useAppStore.getState().rotateShowcasePlacement('plant')).toBe(true)
    expect(useAppStore.getState().showcasePlacements?.[0].rotation).toBe(1)
    for (let i = 0; i < 3; i++) useAppStore.getState().rotateShowcasePlacement('plant')
    expect(useAppStore.getState().showcasePlacements?.[0].rotation).toBeUndefined()

    // 贴右下角：旋转后必然越界
    seedSandboxes(
      [
        {
          ...baseSandbox('sandbox-1'),
          placements: [{ blueprintId: 'plant', gridX: 25, gridY: 25 }]
        }
      ],
      'sandbox-1'
    )
    expect(useAppStore.getState().rotateShowcasePlacement('plant')).toBe(false)
    expect(useAppStore.getState().showcasePlacements?.[0].rotation).toBeUndefined()
    expect(useAppStore.getState().rotateShowcasePlacement('ghost')).toBe(false)
  })

  it('收拢只影响当前沙盘；堆场陈列会把建筑从其他沙盘移过来', () => {
    seedSandboxes(
      [
        {
          ...baseSandbox('sandbox-1'),
          placements: [{ blueprintId: 'plant', gridX: 1, gridY: 1 }]
        },
        baseSandbox('sandbox-2', 'stone')
      ],
      'sandbox-1'
    )
    expect(useAppStore.getState().tuckShowcaseBuilding('plant')).toBe(true)
    expect(useAppStore.getState().showcasePlacements).toEqual([])
    expect(sandboxes()[0].placements).toEqual([])

    // 切到 sandbox-2：plant 不在任何沙盘 → 待陈列；点击放上
    useAppStore.getState().switchShowcaseSandbox('sandbox-2')
    expect(useAppStore.getState().placeShowcaseBuilding('plant')).toBe(true)
    expect(sandboxes()[1].placements.length).toBe(1)
    // 已在当前沙盘，重复放置返回 false
    expect(useAppStore.getState().placeShowcaseBuilding('plant')).toBe(false)
    // 未落成建筑不可陈列
    expect(useAppStore.getState().placeShowcaseBuilding('castle')).toBe(false)
  })

  it('其他沙盘上的建筑陈列到当前沙盘 = 移动（全局唯一）', () => {
    seedSandboxes(
      [
        {
          ...baseSandbox('sandbox-1'),
          placements: [{ blueprintId: 'plant', gridX: 1, gridY: 1, rotation: 2 }]
        },
        baseSandbox('sandbox-2', 'stone')
      ],
      'sandbox-2'
    )
    expect(useAppStore.getState().placeShowcaseBuilding('plant')).toBe(true)
    expect(sandboxes()[0].placements).toEqual([])
    const moved = sandboxes()[1].placements
    expect(moved.length).toBe(1)
    expect(moved[0].blueprintId).toBe('plant')
    // 移动后按新落位重新开始，不复用旧沙盘的旋转
    expect(moved[0].rotation).toBeUndefined()
  })

  it('自动排列只重排当前沙盘已有陈列，不把其他落成建筑拉进来，并保留旋转', () => {
    seedSandboxes(
      [
        {
          ...baseSandbox('sandbox-1'),
          placements: [{ blueprintId: 'plant', gridX: 0, gridY: 0, rotation: 1 }]
        }
      ],
      'sandbox-1'
    )
    expect(useAppStore.getState().autoArrangeShowcase()).toBe(true)
    const stored = useAppStore.getState().showcasePlacements ?? []
    expect(stored.map((p) => p.blueprintId)).toEqual(['plant'])
    expect(stored[0].rotation).toBe(1)
    expect(useAppStore.getState().showcaseSandboxes?.[0].placements.length).toBe(1)
  })

  it('导出存档包含沙盘、当前 id 与镜像；旋转随存档留下去', () => {
    seedSandboxes(
      [
        {
          ...baseSandbox('sandbox-1'),
          placements: [{ blueprintId: 'plant', gridX: 2, gridY: 2, rotation: 3 }]
        }
      ],
      'sandbox-1'
    )
    const exported = JSON.parse(useAppStore.getState().exportData()) as {
      showcaseSandboxes?: ShowcaseSandbox[]
      activeSandboxId?: string
      showcasePlacements?: Array<{ blueprintId: string; rotation?: number }>
    }
    expect(exported.activeSandboxId).toBe('sandbox-1')
    expect(exported.showcaseSandboxes?.length).toBe(1)
    expect(exported.showcasePlacements?.[0].rotation).toBe(3)
  })
})
