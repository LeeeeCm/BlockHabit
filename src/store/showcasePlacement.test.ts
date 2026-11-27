import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'
import { blueprintOrder, blueprints, getBlueprint } from '../logic/blueprints'
import {
  canPlaceModel,
  getModelFootprint,
  getRotatedFootprint,
  rotationsFromPlacements,
  SHOWCASE_GRID_SIZE
} from '../logic/showcase'
import type { ShowcasePlacement } from '../types'

/**
 * D-20261127-127：旋转随 placement 持久化后，updateShowcasePlacement 的落位校验口径。
 *
 * 旧 D-068 的会话 rotations 参数已删除；现在：
 *   1) 邻居的占用按各自 placement.rotation 计算；
 *   2) 被移动目标自身的 rotation 保留并参与边界/碰撞；
 *   3) store 判定与 canPlaceModel（显式传入同一旋转表）逐位一致；
 *   4) 未知蓝图仍拒绝。
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
    showcasePlacements: placements,
    showcaseSandboxes: undefined,
    activeSandboxId: undefined
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

describe('updateShowcasePlacement 的持久化旋转口径', () => {
  let rectId = ''
  let targetId = ''

  beforeEach(() => {
    rectId = findNonSquareId()
    targetId = findSmallTargetId(rectId)
  })

  it('邻居按 placement.rotation 计算占地：0° 与 90° 的结论必须不同', () => {
    const fp0 = getModelFootprint(getBlueprint(rectId)!.blocks)
    const fp1 = getRotatedFootprint(getBlueprint(rectId)!.blocks, 1)
    expect(fp1.width).toBe(fp0.depth)
    const x = Math.min(fp0.width, fp1.width)
    const targetFp = getModelFootprint(getBlueprint(targetId)!.blocks)
    expect(x + targetFp.width).toBeLessThanOrEqual(SHOWCASE_GRID_SIZE)

    resetStore([{ blueprintId: rectId, gridX: 0, gridY: 0 }])
    const at0 = useAppStore.getState().updateShowcasePlacement(targetId, x, 0)

    resetStore([{ blueprintId: rectId, gridX: 0, gridY: 0, rotation: 1 }])
    const at90 = useAppStore.getState().updateShowcasePlacement(targetId, x, 0)

    expect(at0).not.toBe(at90)
    // 被拒绝的那一次不得改写存档
    const stored = useAppStore.getState().showcasePlacements
    if (!at90) {
      expect(stored).toEqual([{ blueprintId: rectId, gridX: 0, gridY: 0, rotation: 1 }])
    }
  })

  it('被移动目标自身的旋转也参与占地：越界与否由旋转后的深度决定', () => {
    const fp0 = getModelFootprint(getBlueprint(rectId)!.blocks)
    const fp1 = getRotatedFootprint(getBlueprint(rectId)!.blocks, 1)
    const y = SHOWCASE_GRID_SIZE - fp0.depth
    expect(y + fp0.depth <= SHOWCASE_GRID_SIZE).toBe(true)
    expect(y + fp1.depth <= SHOWCASE_GRID_SIZE).toBe(false)

    resetStore([{ blueprintId: rectId, gridX: 0, gridY: y }])
    expect(useAppStore.getState().updateShowcasePlacement(rectId, 0, y)).toBe(true)

    resetStore([{ blueprintId: rectId, gridX: 0, gridY: y, rotation: 1 }])
    expect(useAppStore.getState().updateShowcasePlacement(rectId, 0, y)).toBe(false)
  })

  it('拖拽只改位置：已有 rotation 原样保留', () => {
    resetStore([{ blueprintId: rectId, gridX: 0, gridY: 0, rotation: 2 }])
    expect(useAppStore.getState().updateShowcasePlacement(rectId, 1, 1)).toBe(true)
    expect(useAppStore.getState().showcasePlacements).toEqual([
      { blueprintId: rectId, gridX: 1, gridY: 1, rotation: 2 }
    ])
  })

  it('与 canPlaceModel 同口径：store 的落位判定不能比纯函数更宽松或更严格', () => {
    const fp0 = getModelFootprint(getBlueprint(rectId)!.blocks)
    const x = Math.min(fp0.width, fp0.depth)
    for (const rotation of [0, 1, 2, 3]) {
      const existing: ShowcasePlacement[] = [
        { blueprintId: rectId, gridX: 0, gridY: 0, ...(rotation ? { rotation } : null) }
      ]
      const rotations = rotationsFromPlacements(existing)
      resetStore(existing)
      const viaStore = useAppStore.getState().updateShowcasePlacement(targetId, x, 0)
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

  it('未知蓝图仍拒绝（脏数据不写进存档）', () => {
    resetStore([])
    expect(useAppStore.getState().updateShowcasePlacement('ghost', 0, 0)).toBe(false)
    expect(useAppStore.getState().showcasePlacements).toEqual([])
  })

  it('蓝图注册表覆盖全部 blueprintOrder（回归保护，避免测试前提静默失效）', () => {
    for (const id of blueprintOrder) expect(blueprints[id]).toBeDefined()
  })
})
