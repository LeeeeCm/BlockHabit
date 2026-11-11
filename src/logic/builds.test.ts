import { describe, expect, it } from 'vitest'
import {
  BLUEPRINT_CAPACITY,
  buildsMatchFacts,
  rebuildBuilds,
  removeBlocksAndCompact,
} from './builds'
import { blueprints } from './blueprints'
import type { CheckIn, DayClaim, PlacedBlock } from '../types'

/**
 * D-20261110-042：积木层是「打卡 + 全勤」事实的确定性投影，此前无单测。
 * 它决定多端同步合并、导入、撤销打卡后的数据一致性，属于最高风险区之一。
 */

const ci = (over: Partial<CheckIn>): CheckIn =>
  ({ id: 'c', habitId: 'h1', date: '2026-01-01', at: '2026-01-01T08:00:00.000Z', ...over }) as CheckIn
const claim = (over: Partial<DayClaim>): DayClaim =>
  ({ date: '2026-01-01', claimedAt: '2026-01-01T20:00:00.000Z', blockId: 'd1', blueprintId: 'plant', ...over }) as DayClaim
const block = (over: Partial<PlacedBlock>): PlacedBlock =>
  ({ id: 'b', blueprintId: 'plant', index: 0, placedAt: '2026-01-01T08:00:00.000Z', fromHabitId: 'h1', bonus: false, ...over }) as PlacedBlock

describe('rebuildBuilds', () => {
  it('只投影带 blockId/blueprintId 且未墓碑化的打卡', () => {
    const out = rebuildBuilds(
      [
        ci({ id: 'c1', placedBlockId: 'b1', blueprintId: 'plant' }),
        ci({ id: 'c2', placedBlockId: 'b2', blueprintId: 'plant', deletedAt: '2026-01-02T00:00:00.000Z' }),
        ci({ id: 'c3' }), // 无块信息（例如计数器未达标）
      ],
      [],
    )
    expect(out.map((b) => b.id)).toEqual(['b1'])
  })

  it('全勤块来自 DayClaim：bonus 为 true、来源为 __day__', () => {
    const out = rebuildBuilds([], [claim({ blockId: 'd1' })])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'd1', fromHabitId: '__day__', bonus: true, index: 0 })
  })

  it('按 placedAt 升序、id 决胜，index 连续 0..N-1', () => {
    const out = rebuildBuilds(
      [
        ci({ id: 'c2', placedBlockId: 'b-b', blueprintId: 'plant', at: '2026-01-02T08:00:00.000Z' }),
        ci({ id: 'c1', placedBlockId: 'b-a', blueprintId: 'plant', at: '2026-01-01T08:00:00.000Z' }),
        ci({ id: 'c3', placedBlockId: 'b-c', blueprintId: 'plant', at: '2026-01-02T08:00:00.000Z' }),
      ],
      [],
    )
    // 同一时刻按 id 决胜：b-b < b-c
    expect(out.map((b) => b.id)).toEqual(['b-a', 'b-b', 'b-c'])
    expect(out.map((b) => b.index)).toEqual([0, 1, 2])
  })

  it('超出蓝图容量的多余事实不投影（事实层数据保留）', () => {
    const capacity = { plant: 2 }
    const checkIns = [1, 2, 3, 4].map((n) =>
      ci({ id: 'c' + n, placedBlockId: 'b' + n, blueprintId: 'plant', at: '2026-01-0' + n + 'T08:00:00.000Z' }),
    )
    const out = rebuildBuilds(checkIns, [], capacity)
    expect(out.map((b) => b.id)).toEqual(['b1', 'b2'])
    expect(checkIns).toHaveLength(4) // 不改事实
  })

  it('容量 0 时整组不投影', () => {
    const out = rebuildBuilds([ci({ placedBlockId: 'b1', blueprintId: 'plant' })], [], { plant: 0 })
    expect(out).toEqual([])
  })

  it('多蓝图输出按 (blueprintId, index) 稳定排序', () => {
    const out = rebuildBuilds(
      [
        ci({ id: 'c1', placedBlockId: 'z1', blueprintId: 'windmill', at: '2026-01-01T08:00:00.000Z' }),
        ci({ id: 'c2', placedBlockId: 'a1', blueprintId: 'coffee', at: '2026-01-01T09:00:00.000Z' }),
      ],
      [],
    )
    expect(out.map((b) => b.blueprintId)).toEqual(['coffee', 'windmill'])
  })
})

describe('buildsMatchFacts', () => {
  const checkIns = [ci({ id: 'c1', placedBlockId: 'b1', blueprintId: 'plant', at: '2026-01-01T08:00:00.000Z' })]
  const expected = rebuildBuilds(checkIns, [])

  it('等价投影 → true', () => {
    expect(buildsMatchFacts(expected, checkIns, [])).toBe(true)
  })

  it('多出一块无法由事实推导的块 → false（重建会丢数据）', () => {
    const extra = [...expected, block({ id: 'ghost', index: 1 })]
    expect(buildsMatchFacts(extra, checkIns, [])).toBe(false)
  })

  it('同一 id 但蓝图不同 → false', () => {
    const wrong = expected.map((b) => ({ ...b, blueprintId: 'coffee' }))
    expect(buildsMatchFacts(wrong, checkIns, [])).toBe(false)
  })

  it('只看 id 与蓝图，不比 index（旧档 index 偏移不应触发重建）', () => {
    const shifted = expected.map((b) => ({ ...b, index: 99 }))
    expect(buildsMatchFacts(shifted, checkIns, [])).toBe(true)
  })
})

describe('removeBlocksAndCompact', () => {
  it('删除指定块并把同蓝图 index 压实，其余块原样保留', () => {
    const builds = [block({ id: 'a', index: 0 }), block({ id: 'b', index: 1 }), block({ id: 'c', index: 2 })]
    const out = removeBlocksAndCompact(builds, new Set(['b']))
    expect(out.map((x) => x.id)).toEqual(['a', 'c'])
    expect(out.map((x) => x.index)).toEqual([0, 1])
  })

  it('跨蓝图各自独立压实', () => {
    const builds = [
      block({ id: 'p0', blueprintId: 'plant', index: 0 }),
      block({ id: 'p1', blueprintId: 'plant', index: 1 }),
      block({ id: 'c0', blueprintId: 'coffee', index: 0 }),
      block({ id: 'c1', blueprintId: 'coffee', index: 1 }),
    ]
    const out = removeBlocksAndCompact(builds, new Set(['p0', 'c1']))
    expect(out.map((x) => x.id)).toEqual(['c0', 'p1'])
    expect(out.map((x) => x.index)).toEqual([0, 0])
  })

  it('保留无法由事实推导的块（不重建、只删指定块）', () => {
    const builds = [block({ id: 'ghost', index: 0 }), block({ id: 'real', index: 1 })]
    const out = removeBlocksAndCompact(builds, new Set(['real']))
    expect(out.map((x) => x.id)).toEqual(['ghost'])
  })
})

describe('BLUEPRINT_CAPACITY', () => {
  it('容量与蓝图块数一致，且覆盖全部蓝图', () => {
    for (const [id, bp] of Object.entries(blueprints)) {
      expect(BLUEPRINT_CAPACITY[id]).toBe(bp.blocks.length)
    }
  })
})
