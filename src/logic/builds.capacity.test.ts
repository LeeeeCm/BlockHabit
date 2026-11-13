import { describe, it, expect } from 'vitest'
import {
  rebuildBuilds,
  buildsMatchFacts,
  removeBlocksAndCompact,
  BLUEPRINT_CAPACITY
} from './builds'
import { blueprintOrder, getBlueprint } from './blueprints'
import type { CheckIn, DayClaim, PlacedBlock } from '../types'

/**
 * A8 / A5b 回归：
 * - 投影必须按蓝图容量钳制（多端离线各自建满后合并会超出）；
 * - 旧档/外部导入的 builds 可能与事实不一致，此时不能全量重建（会丢块），改用保守移除；
 * - uncheckIn 用 buildsMatchFacts 决定走哪条路径。
 */
function ci(i: number, bp = 'plant'): CheckIn {
  const n = String(i).padStart(4, '0')
  return {
    id: `c${n}`,
    habitId: 'h1',
    date: '2026-01-01',
    at: `2026-01-01T00:00:${(i % 60).toString().padStart(2, '0')}.000Z`,
    placedBlockId: `b${n}`,
    blueprintId: bp
  }
}

function build(id: string, index: number, bp = 'plant'): PlacedBlock {
  return {
    id,
    blueprintId: bp,
    index,
    placedAt: '2026-01-01T00:00:00.000Z',
    fromHabitId: 'h1',
    bonus: false
  }
}

describe('rebuildBuilds 容量钳制', () => {
  it('超出蓝图块数的多余事实不再投影（事实层打卡保留）', () => {
    const capacity = getBlueprint('plant').blocks.length
    const checkIns = Array.from({ length: capacity + 6 }, (_, i) => ci(i))
    const builds = rebuildBuilds(checkIns, [])
    expect(builds).toHaveLength(capacity)
    // index 连续 0..cap-1
    expect(builds.map((b) => b.index)).toEqual(Array.from({ length: capacity }, (_, i) => i))
  })

  it('容量表覆盖全部蓝图（基础 12 + 内容包 v2 6 + v3 5，自动派生）', () => {
    expect(Object.keys(BLUEPRINT_CAPACITY)).toHaveLength(blueprintOrder.length)
    expect(blueprintOrder.length).toBeGreaterThanOrEqual(23)
  })
})

describe('buildsMatchFacts', () => {
  it('事实与投影一致时为 true', () => {
    const checkIns = [ci(1), ci(2)]
    const builds = rebuildBuilds(checkIns, [])
    expect(buildsMatchFacts(builds, checkIns, [])).toBe(true)
  })

  it('存在无法由事实推导的块时为 false（旧档场景）', () => {
    const checkIns = [ci(1)]
    const builds = [build('b0001', 0), build('legacy-1', 1)]
    expect(buildsMatchFacts(builds, checkIns, [])).toBe(false)
  })

  it('全勤块由 dayClaims 提供时视为一致', () => {
    const claims: DayClaim[] = [
      {
        date: '2026-01-02',
        claimedAt: '2026-01-02T12:00:00.000Z',
        blockId: 'day-1',
        blueprintId: 'plant'
      }
    ]
    const builds = rebuildBuilds([], claims)
    expect(buildsMatchFacts(builds, [], claims)).toBe(true)
  })
})

describe('removeBlocksAndCompact', () => {
  it('只删指定块并压实 index，其余块原样保留', () => {
    const builds = [build('a', 0), build('b', 1), build('c', 2)]
    const next = removeBlocksAndCompact(builds, new Set(['b']))
    expect(next.map((b) => b.id)).toEqual(['a', 'c'])
    expect(next.map((b) => b.index)).toEqual([0, 1])
  })

  it('按蓝图分组各自压实，不改蓝图归属', () => {
    const builds = [build('p0', 0, 'plant'), build('p1', 1, 'plant'), build('c0', 0, 'castle')]
    const next = removeBlocksAndCompact(builds, new Set(['p0']))
    expect(next.filter((b) => b.blueprintId === 'plant').map((b) => b.id)).toEqual(['p1'])
    expect(next.filter((b) => b.blueprintId === 'plant')[0].index).toBe(0)
    expect(next.filter((b) => b.blueprintId === 'castle')[0].index).toBe(0)
  })
})
