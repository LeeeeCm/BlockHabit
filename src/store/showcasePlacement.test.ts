import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'
import { blueprintOrder, blueprints, getBlueprint } from '../logic/blueprints'
import {
  canPlaceModel,
  getModelFootprint,
  getRotatedFootprint,
  SHOWCASE_GRID_SIZE
} from '../logic/showcase'
import type { ShowcasePlacement } from '../types'

/**
 * D-20261111-068（approved）+ 2026-11-14 追加：updateShowcasePlacement 的会话旋转参数。
 *
 * 装饰模式把 90° 旋转做成「本次会话的视图态」，但拖拽落位原先仍按 0° 占地校验，
 * 于是出现「画面上不重叠却拖不过去」/「画面上重叠却能拖过去」两类假冲突（D-068 已知限制）。
 * 本文件锁住三件事：
 *   1) 传入 rotations 时，落位校验与渲染同口径（邻居 / 自己都按当前旋转算 AABB）；
 *   2) 不传 rotations 时行为与旧实现逐位一致（向后兼容）；
 *   3) 旋转绝不写进存档字段（不改持久化 schema）。
 */

function resetStore(placements: ShowcasePlacement[]) {
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
    showcasePlacements: placements
  })
}

/** 第一座非正方形蓝图的 id：只有宽 ≠ 深，90° 旋转才会真的改变占地 */
function findNonSquareId(): string {
  for (const id of blueprintOrder) {
    const bp = getBlueprint(id)
    if (!bp) continue
    const fp = getModelFootprint(bp.blocks)
    if (fp.width !== fp.depth) return id
  }
  throw new Error('蓝图注册表里没有非正方形模型，测试前提不成立')
}

/** 面积最小的另一座蓝图，用来做「被移动的目标」，保证 x/y 方向还有余地 */
function findSmallTargetId(excludeId: string): string {
  let best: { id: string; area: number } | null = null
  for (const id of blueprintOrder) {
    if (id === excludeId) continue
    const bp = getBlueprint(id)
    if (!bp) continue
    const fp = getModelFootprint(bp.blocks)
    const area = fp.width * fp.depth
    if (!best || area < best.area) best = { id, area }
  }
  if (!best) throw new Error('蓝图注册表里没有第二座可用模型')
  return best.id
}

describe('updateShowcasePlacement 的会话旋转参数（收敛 D-068 已知限制）', () => {
  let rectId = ''
  let targetId = ''

  beforeEach(() => {
    rectId = findNonSquareId()
    targetId = findSmallTargetId(rectId)
  })

  it('邻居按当前会话旋转计算占地：0° 与 90° 的结论必须不同', () => {
    const bp0 = getModelFootprint(getBlueprint(rectId)!.blocks)
    const bp1 = getRotatedFootprint(getBlueprint(rectId)!.blocks, 1)
    // 只有宽深互换过的城市：x 取两者较窄的宽度 → 一个口径「刚好不重叠」，另一个「重叠」
    expect(bp1.width).toBe(bp0.depth)
    const x = Math.min(bp0.width, bp1.width)
    const targetFp = getModelFootprint(getBlueprint(targetId)!.blocks)
    expect(x + targetFp.width).toBeLessThanOrEqual(SHOWCASE_GRID_SIZE)

    resetStore([{ blueprintId: rectId, gridX: 0, gridY: 0 }])
    const at0 = useAppStore.getState().updateShowcasePlacement(targetId, x, 0, {})

    resetStore([{ blueprintId: rectId, gridX: 0, gridY: 0 }])
    const at90 = useAppStore.getState().updateShowcasePlacement(targetId, x, 0, { [rectId]: 1 })

    expect(at0).not.toBe(at90)
    // 被拒绝的那一次不得改写存档
    const stored = useAppStore.getState().showcasePlacements
    if (!at90) {
      expect(stored).toEqual([{ blueprintId: rectId, gridX: 0, gridY: 0 }])
    }
  })

  it('目标自身的旋转也参与占地：越界与否由旋转后的深度决定', () => {
    const fp0 = getModelFootprint(getBlueprint(rectId)!.blocks)
    const fp1 = getRotatedFootprint(getBlueprint(rectId)!.blocks, 1)
    // 贴着下边界放：0° 刚好贴边，90° 深度变成原宽度后是否溢出由几何决定
    const y = SHOWCASE_GRID_SIZE - fp0.depth
    const fits0 = y + fp0.depth <= SHOWCASE_GRID_SIZE
    const fits1 = y + fp1.depth <= SHOWCASE_GRID_SIZE
    expect(fits0).toBe(true)
    expect(fits1).toBe(false) // 非正方形 ⇒ 深度必有一边更大

    resetStore([])
    expect(useAppStore.getState().updateShowcasePlacement(rectId, 0, y, {})).toBe(fits0)

    resetStore([])
    expect(useAppStore.getState().updateShowcasePlacement(rectId, 0, y, { [rectId]: 1 })).toBe(
      fits1
    )
  })

  it('不传 rotations 时行为与旧实现一致（按 0° 占地校验）', () => {
    const fp0 = getModelFootprint(getBlueprint(rectId)!.blocks)
    resetStore([{ blueprintId: rectId, gridX: 0, gridY: 0 }])
    const targetFp = getModelFootprint(getBlueprint(targetId)!.blocks)
    expect(fp0.width + targetFp.width).toBeLessThanOrEqual(SHOWCASE_GRID_SIZE)
    // 旧调用点（3 个参数）只看 0° 占地
    expect(useAppStore.getState().updateShowcasePlacement(targetId, fp0.width, 0)).toBe(true)
    resetStore([{ blueprintId: rectId, gridX: 0, gridY: 0 }])
    expect(useAppStore.getState().updateShowcasePlacement(targetId, 0, 0)).toBe(false)
  })

  it('与 canPlaceModel 同口径：store 的落位判定不能比纯函数更宽松或更严格', () => {
    const fp0 = getModelFootprint(getBlueprint(rectId)!.blocks)
    const x = Math.min(fp0.width, fp0.depth)
    const existing: ShowcasePlacement[] = [{ blueprintId: rectId, gridX: 0, gridY: 0 }]
    for (const rotations of [{}, { [rectId]: 1 }, { [rectId]: 2 }, { [rectId]: 3 }]) {
      resetStore(existing)
      const viaStore = useAppStore.getState().updateShowcasePlacement(targetId, x, 0, rotations)
      const viaPure = canPlaceModel(
        { blueprintId: targetId, gridX: x, gridY: 0 },
        existing,
        blueprints,
        SHOWCASE_GRID_SIZE,
        rotations
      )
      expect(viaStore).toBe(viaPure)
    }
  })

  it('旋转不写入存档：placement 仍只有蓝图 id 与格点', () => {
    resetStore([])
    expect(useAppStore.getState().updateShowcasePlacement('plant', 0, 0, { plant: 2 })).toBe(true)
    const stored = useAppStore.getState().showcasePlacements ?? []
    expect(stored).toEqual([{ blueprintId: 'plant', gridX: 0, gridY: 0 }])
    expect(Object.keys(stored[0] ?? {}).sort()).toEqual(['blueprintId', 'gridX', 'gridY'])
  })

  it('未知蓝图仍拒绝（脏数据不写进存档）', () => {
    resetStore([])
    expect(useAppStore.getState().updateShowcasePlacement('ghost', 0, 0, { ghost: 1 })).toBe(false)
    expect(useAppStore.getState().showcasePlacements).toEqual([])
  })

  it('蓝图注册表覆盖全部 blueprintOrder（回归保护，避免测试前提静默失效）', () => {
    for (const id of blueprintOrder) expect(blueprints[id]).toBeDefined()
  })
})
