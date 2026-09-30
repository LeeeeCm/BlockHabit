import { describe, it, expect } from 'vitest'
import { mergeAppState } from './merge'
import { rebuildBuilds } from '../logic/builds'
import { getBlueprint } from '../logic/blueprints'
import type { AppState, CheckIn, DayClaim, Habit } from '../types'

function createMockState(overrides: Partial<AppState> = {}): AppState {
  return {
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: [],
    deletedDayClaims: [],
    repairBricks: 0,
    showcasePlacements: [],
    foundationNotes: {},
    ...overrides,
  }
}

function claim(date: string, claimedAt: string, blockId: string, blueprintId = 'plant'): DayClaim {
  return { date, claimedAt, blockId, blueprintId }
}

/** 近期日期（ISO 日期部分）：GC 会清理 90 天前的墓碑，测试夹具必须贴近当前时间 */
function recentDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return key
}

function recentIso(daysAgo: number, hour = 8): string {
  const h = String(hour).padStart(2, '0')
  return `${recentDate(daysAgo)}T${h}:00:00.000Z`
}

describe('mergeAppState facts merge (schema v2)', () => {
  it('union merges checkIns from both devices by id or habitId+date, preserving all check-ins', () => {
    const checkIn1: CheckIn = {
      id: 'c1',
      habitId: 'h1',
      date: '2026-03-01',
      at: '2026-03-01T08:00:00.000Z',
      note: 'Morning run in park',
    }
    const checkIn2: CheckIn = {
      id: 'c2',
      habitId: 'h1',
      date: '2026-03-02',
      at: '2026-03-02T08:00:00.000Z',
    }
    const checkIn3: CheckIn = {
      id: 'c3',
      habitId: 'h2',
      date: '2026-03-01',
      at: '2026-03-01T10:00:00.000Z',
    }
    const checkIn1DuplicateId: CheckIn = {
      id: 'c1',
      habitId: 'h1',
      date: '2026-03-01',
      at: '2026-03-01T08:00:00.000Z',
      starred: true,
    }
    const checkIn1DuplicateDay: CheckIn = {
      id: 'c1-remote',
      habitId: 'h1',
      date: '2026-03-01',
      at: '2026-03-01T08:05:00.000Z',
      mood: 'energetic',
    }

    const local = createMockState({ checkIns: [checkIn1, checkIn2] })
    const remote = createMockState({ checkIns: [checkIn1DuplicateId, checkIn1DuplicateDay, checkIn3] })

    const merged = mergeAppState(local, remote)

    expect(merged.checkIns.length).toBe(3)
    const mergedC1 = merged.checkIns.find((c) => c.habitId === 'h1' && c.date === '2026-03-01')
    expect(mergedC1).toBeDefined()
    expect(mergedC1?.note).toBe('Morning run in park')
    expect(mergedC1?.starred).toBe(true)
    expect(mergedC1?.mood).toBe('energetic')
    expect(merged.checkIns.some((c) => c.id === 'c2')).toBe(true)
    expect(merged.checkIns.some((c) => c.id === 'c3')).toBe(true)
  })

  it('preserves multiple daily check-ins for counter habits without merging them away', () => {
    const waterHabit: Habit = {
      id: 'h_water',
      name: 'Drink water',
      kind: 'counter',
      targetValue: 2000,
      step: 250,
      unit: 'ml',
      frequency: { type: 'daily' },
      createdAt: '2026-03-01T00:00:00.000Z',
    }
    const local = createMockState({
      habits: [waterHabit],
      checkIns: [
        { id: 'cw1', habitId: 'h_water', date: '2026-03-01', at: '2026-03-01T09:00:00.000Z', value: 250 },
        { id: 'cw2', habitId: 'h_water', date: '2026-03-01', at: '2026-03-01T11:00:00.000Z', value: 250 },
      ],
    })
    const remote = createMockState({
      habits: [waterHabit],
      checkIns: [
        { id: 'cw3', habitId: 'h_water', date: '2026-03-01', at: '2026-03-01T14:00:00.000Z', value: 250 },
        { id: 'cw4', habitId: 'h_water', date: '2026-03-01', at: '2026-03-01T17:00:00.000Z', value: 250 },
      ],
    })

    const merged = mergeAppState(local, remote)
    expect(merged.checkIns).toHaveLength(4)
    expect(merged.checkIns.map((c) => c.id).sort()).toEqual(['cw1', 'cw2', 'cw3', 'cw4'])
  })

  it('undo (tombstone) on one device is not resurrected by the other (deletion wins)', () => {
    const liveCheckIn: CheckIn = {
      id: 'c1',
      habitId: 'h1',
      date: recentDate(1),
      at: recentIso(1),
      placedBlockId: 'b0',
      blueprintId: 'plant',
    }
    const undoneCheckIn: CheckIn = { ...liveCheckIn, deletedAt: recentIso(0, 9) }

    // 设备 A 已撤销；设备 B 仍有这条打卡
    const local = createMockState({ checkIns: [undoneCheckIn] })
    const remote = createMockState({ checkIns: [liveCheckIn] })

    const merged = mergeAppState(local, remote)
    const c1 = merged.checkIns.find((c) => c.id === 'c1')!
    expect(c1.deletedAt).toBe(recentIso(0, 9))
    // 积木投影不再包含被撤销的块
    expect(merged.builds.filter((b) => b.id === 'b0')).toHaveLength(0)
  })

  it('index compaction on undo does not resurrect ghost blocks (projection rebuilt, not index-unioned)', () => {
    // 设备 A 建了三块后撤销中间一块：c2 带墓碑，b1 回收，b0/b2 压实为 index 0,1
    // （旧算法按 ${blueprintId}_${index} 并集会复活 3 块）
    const local = createMockState({
      checkIns: [
        { id: 'c1', habitId: 'h1', date: recentDate(3), at: recentIso(3), placedBlockId: 'b0', blueprintId: 'plant' },
        { id: 'c2', habitId: 'h1', date: recentDate(2), at: recentIso(2), placedBlockId: 'b1', blueprintId: 'plant', deletedAt: recentIso(0, 9) },
        { id: 'c3', habitId: 'h1', date: recentDate(1), at: recentIso(1), placedBlockId: 'b2', blueprintId: 'plant' },
      ],
    })
    const remote = createMockState({
      checkIns: [
        { id: 'c1', habitId: 'h1', date: recentDate(3), at: recentIso(3), placedBlockId: 'b0', blueprintId: 'plant' },
        { id: 'c2', habitId: 'h1', date: recentDate(2), at: recentIso(2), placedBlockId: 'b1', blueprintId: 'plant' },
        { id: 'c3', habitId: 'h1', date: recentDate(1), at: recentIso(1), placedBlockId: 'b2', blueprintId: 'plant' },
      ],
    })

    const merged = mergeAppState(local, remote)
    const plantBlocks = merged.builds.filter((b) => b.blueprintId === 'plant')
    // c2 在 A 上被撤销：最终只有 b0、b2 两块，index 连续 0..1，无幽灵块
    expect(plantBlocks.map((b) => b.id).sort()).toEqual(['b0', 'b2'])
    expect(plantBlocks.map((b) => b.index).sort((a, b) => a - b)).toEqual([0, 1])
  })

  it('merged builds equal rebuildBuilds projection (invariant)', () => {
    const local = createMockState({
      checkIns: [
        { id: 'c1', habitId: 'h1', date: '2026-03-01', at: '2026-03-01T08:00:00.000Z', placedBlockId: 'b0', blueprintId: 'plant' },
      ],
      dayClaims: [claim('2026-03-02', '2026-03-02T20:00:00.000Z', 'd0', 'plant')],
    })
    const remote = createMockState({
      checkIns: [
        { id: 'c2', habitId: 'h2', date: '2026-03-03', at: '2026-03-03T08:00:00.000Z', placedBlockId: 'b1', blueprintId: 'castle' },
      ],
    })

    const merged = mergeAppState(local, remote)
    expect(merged.builds).toEqual(rebuildBuilds(merged.checkIns, merged.dayClaims))
  })

  it('merges habits with updatedAt LWW: newest edit wins across devices', () => {
    const base = {
      id: 'h2',
      frequency: { type: 'daily' } as const,
      createdAt: '2026-01-02T00:00:00.000Z',
    }
    const localRenamed: Habit = { ...base, name: '读书（新版）', updatedAt: '2026-03-05T00:00:00.000Z' }
    const remoteOriginal: Habit = { ...base, name: 'Reading', updatedAt: '2026-03-01T00:00:00.000Z' }

    const merged = mergeAppState(
      createMockState({ habits: [localRenamed] }),
      createMockState({ habits: [remoteOriginal] }),
    )
    expect(merged.habits[0].name).toBe('读书（新版）')

    // 反向：远端更新更晚 → 远端胜
    const merged2 = mergeAppState(
      createMockState({ habits: [remoteOriginal] }),
      createMockState({ habits: [localRenamed] }),
    )
    expect(merged2.habits[0].name).toBe('读书（新版）')
  })

  it('merges habits without updatedAt (legacy) with local priority (backward compatible)', () => {
    const habit1: Habit = {
      id: 'h1',
      name: 'Running',
      frequency: { type: 'daily' },
      createdAt: '2026-01-01T00:00:00.000Z',
      category: 'Sport',
    }
    const habit2Local: Habit = {
      id: 'h2',
      name: 'Reading',
      frequency: { type: 'daily' },
      createdAt: '2026-01-02T00:00:00.000Z',
      pinned: true,
    }
    const habit2Remote: Habit = {
      id: 'h2',
      name: 'Reading Books',
      frequency: { type: 'daily' },
      createdAt: '2026-01-02T00:00:00.000Z',
      archivedAt: '2026-02-01T00:00:00.000Z',
    }
    const habit3Remote: Habit = {
      id: 'h3',
      name: 'Meditation',
      frequency: { type: 'weekly', times: 3 },
      createdAt: '2026-02-01T00:00:00.000Z',
    }

    const merged = mergeAppState(
      createMockState({ habits: [habit1, habit2Local] }),
      createMockState({ habits: [habit2Remote, habit3Remote] }),
    )

    expect(merged.habits.length).toBe(3)
    const h2 = merged.habits.find((h) => h.id === 'h2')!
    expect(h2.name).toBe('Reading') // 双方都无 updatedAt：本地优先（旧行为）
    expect(h2.pinned).toBe(true)
  })

  it('filters out custom habits with empty days array during merge', () => {
    const validHabit: Habit = {
      id: 'h1',
      name: 'Valid Custom',
      frequency: { type: 'custom', days: [1, 3] },
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const emptyCustomRemote: Habit = {
      id: 'h_empty_remote',
      name: 'Empty Remote',
      frequency: { type: 'custom', days: [] },
      createdAt: '2026-01-02T00:00:00.000Z',
    }
    const emptyCustomLocal: Habit = {
      id: 'h_empty_local',
      name: 'Empty Local',
      frequency: { type: 'custom', days: [] },
      createdAt: '2026-01-03T00:00:00.000Z',
    }

    const merged = mergeAppState(
      createMockState({ habits: [validHabit, emptyCustomLocal] }),
      createMockState({ habits: [emptyCustomRemote] }),
    )

    expect(merged.habits.length).toBe(1)
    expect(merged.habits[0].id).toBe('h1')
  })

  it('merges dayClaims by date with claimedAt/deletedAt LWW', () => {
    // 设备 A 撤销了昨天的全勤（deletedAt 晚于 claimedAt）；设备 B 仍领取
    const local = createMockState({
      dayClaims: [claim(recentDate(2), recentIso(2, 20), 'd3', 'plant')],
      deletedDayClaims: [{ date: recentDate(4), deletedAt: recentIso(4, 21) }],
    })
    const remote = createMockState({
      dayClaims: [
        claim(recentDate(4), recentIso(4, 20), 'd1', 'plant'),
        claim(recentDate(3), recentIso(3, 20), 'd2', 'plant'),
      ],
    })

    const merged = mergeAppState(local, remote)
    const dates = merged.dayClaims.map((c) => c.date).sort()
    // 4 天前领取在 21:00 被撤销（晚于 20:00 领取）→ 不复活；其余保留
    expect(dates).toEqual([recentDate(3), recentDate(2)])
    expect(merged.deletedDayClaims?.some((d) => d.date === recentDate(4))).toBe(true)
  })

  it('re-claim after unclaim restores the day claim (deletedAt older than claimedAt)', () => {
    const local = createMockState({
      dayClaims: [claim(recentDate(0), recentIso(0, 22), 'd1-new', 'plant')],
      deletedDayClaims: [{ date: recentDate(0), deletedAt: recentIso(0, 21) }],
    })
    const remote = createMockState({})

    const merged = mergeAppState(local, remote)
    expect(merged.dayClaims.some((c) => c.date === recentDate(0))).toBe(true)
  })

  it('keeps all settings fields (local priority, remote fallback)', () => {
    const local = createMockState({
      settings: { theme: 'dark', language: 'zh', soundMaterial: 'walnut', enableGentleDecay: false },
    })
    const remote = createMockState({
      settings: { theme: 'light', language: 'en', enableGyroscope: true, soundMaterial: 'metal' },
    })

    const merged = mergeAppState(local, remote)
    expect(merged.settings.theme).toBe('dark') // 本地优先
    expect(merged.settings.soundMaterial).toBe('walnut') // 本地保留
    expect(merged.settings.enableGentleDecay).toBe(false) // 本地保留（旧实现会丢）
    expect(merged.settings.enableGyroscope).toBe(true) // 远端字段回填（旧实现会丢）
  })

  it('merges repairBricks with math.max', () => {
    const local1 = createMockState({ repairBricks: 1 })
    const remote1 = createMockState({ repairBricks: 2 })
    expect(mergeAppState(local1, remote1).repairBricks).toBe(2)

    const local2 = createMockState({ repairBricks: 2 })
    const remote2 = createMockState({ repairBricks: 0 })
    expect(mergeAppState(local2, remote2).repairBricks).toBe(2)
  })

  it('merges foundationNotes and showcasePlacements (local priority)', () => {
    const local = createMockState({
      foundationNotes: { plant: 'First plant note', tower: 'Tower local note' },
      showcasePlacements: [{ blueprintId: 'plant', gridX: 0, gridY: 0 }],
    })
    const remote = createMockState({
      foundationNotes: { tower: 'Tower remote note', castle: 'Castle note' },
      showcasePlacements: [
        { blueprintId: 'plant', gridX: 1, gridY: 1 },
        { blueprintId: 'castle', gridX: 2, gridY: 2 },
      ],
    })

    const merged = mergeAppState(local, remote)

    expect(merged.foundationNotes).toEqual({
      plant: 'First plant note',
      tower: 'Tower local note',
      castle: 'Castle note',
    })
    expect(merged.showcasePlacements?.length).toBe(2)
    const plantP = merged.showcasePlacements?.find((p) => p.blueprintId === 'plant')
    const castleP = merged.showcasePlacements?.find((p) => p.blueprintId === 'castle')
    expect(plantP?.gridX).toBe(0) // Local placement preserved
    expect(castleP?.gridX).toBe(2)
  })

  it('drops completed blueprint when undo reduces rebuilt count below full (real blueprint)', () => {
    const bp = getBlueprint('plant')
    const N = bp.blocks.length
    const mk = (i: number): CheckIn => ({
      id: `c${i}`,
      habitId: 'h1',
      date: recentDate(i + 1),
      at: recentIso(i + 1),
      placedBlockId: `b${i}`,
      blueprintId: 'plant',
    })
    // 本地：建满后撤销最后一块（墓碑）；远端：仍全部在册。双方 completed 都含 plant
    const local = createMockState({
      checkIns: Array.from({ length: N }, (_, i) =>
        i === N - 1 ? { ...mk(i), deletedAt: recentIso(0, 9) } : mk(i),
      ),
      completedBlueprintIds: ['plant'],
    })
    const remote = createMockState({
      checkIns: Array.from({ length: N }, (_, i) => mk(i)),
      completedBlueprintIds: ['plant'],
    })

    const merged = mergeAppState(local, remote)
    // 墓碑胜出 → 投影 N-1 块 → 退回未完成
    expect(merged.completedBlueprintIds).not.toContain('plant')
    expect(merged.builds.filter((b) => b.blueprintId === 'plant')).toHaveLength(N - 1)
  })

  it('keeps habit with equal updatedAt from local side (same-timestamp tie-break)', () => {
    const ts = '2026-03-05T00:00:00.000Z'
    const local: Habit = { id: 'h1', name: '本地名', frequency: { type: 'daily' }, createdAt: ts, updatedAt: ts }
    const remote: Habit = { id: 'h1', name: '远端名', frequency: { type: 'daily' }, createdAt: ts, updatedAt: ts }
    const merged = mergeAppState(createMockState({ habits: [local] }), createMockState({ habits: [remote] }))
    expect(merged.habits[0].name).toBe('本地名')
  })
})
