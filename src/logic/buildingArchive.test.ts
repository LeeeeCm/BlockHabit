import { afterEach, describe, expect, it } from 'vitest'
import type { CheckIn, Habit, PlacedBlock } from '../types'
import { blueprints } from './blueprints'
import {
  blockMetaIndex,
  buildBuildingArchive,
  completionDateOf,
  listArchiveBuildings,
  type BuildingArchiveState,
} from './buildingArchive'
import { completionDateOf as yearbookCompletionDateOf } from './yearbook'

/**
 * B3 建筑档案（D-20261110-065 / technical-notes §7）派生逻辑单测：
 * 空 / 未落成 / 已落成、落成日=max(placedAt)、耗时、奖励/全勤块、Top 习惯并列、
 * 关键块锚点、时间线关联随笔、墓碑排除、第 N 座、旧档不可考、跨年、坏时间戳。
 */

const CREATED = '2024-01-01T00:00:00.000Z'

function habit(id: string, over: Partial<Habit> = {}): Habit {
  return { id, name: id, frequency: { type: 'daily' }, createdAt: CREATED, ...over }
}

function atLocal(date: string, hour = 12): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0).toISOString()
}

function makeBlocks(
  blueprintId: string,
  dates: string[],
  over: Record<number, Partial<PlacedBlock>> = {},
): PlacedBlock[] {
  const bp = blueprints[blueprintId]
  return bp.blocks.map((_, index) => ({
    id: blueprintId + '-' + index,
    blueprintId,
    index,
    placedAt: atLocal(dates[Math.min(index, dates.length - 1)]),
    fromHabitId: 'h1',
    bonus: false,
    ...over[index],
  }))
}

function makeState(over: Partial<BuildingArchiveState> = {}): BuildingArchiveState {
  return {
    builds: [],
    checkIns: [],
    habits: [],
    foundationNotes: {},
    completedBlueprintIds: [],
    ...over,
  }
}

function checkIn(over: Partial<CheckIn> & { id: string; habitId: string; date: string }): CheckIn {
  return { at: atLocal(over.date), ...over }
}

afterEach(() => {
  delete (blueprints as Record<string, unknown>).__small__
})

describe('空数据与未落成', () => {
  it('未知蓝图 / 空数据：未落成、统计为空、不崩', () => {
    const archive = buildBuildingArchive(makeState(), 'unknown-bp')
    expect(archive.completed).toBe(false)
    expect(archive.completedAt).toBeNull()
    expect(archive.totalBlocks).toBe(0)
    expect(archive.milestones).toEqual([])
    expect(archive.notes).toEqual([])
    expect(archive.ordinal).toBeNull()
    expect(archive.totalCompleted).toBe(0)
    expect(archive.archivedAtUnknown).toBe(false)
  })

  it('建造中（块数不足）：未落成，不能编造落成日与耗时天数', () => {
    const partial = makeBlocks('plant', ['2026-02-01']).slice(0, 3)
    const archive = buildBuildingArchive(makeState({ builds: partial }), 'plant')
    expect(archive.completed).toBe(false)
    expect(archive.completedAt).toBeNull()
    expect(archive.days).toBeNull()
    expect(archive.totalBlocks).toBe(3)
    expect(archive.firstPlacedAt).toBe('2026-02-01')
    expect(archive.milestones).toEqual([])
    expect(archive.notes).toEqual([])
  })

  it('completedBlueprintIds 有它但块数不足（旧档/撤销）：落成时间不可考', () => {
    const partial = makeBlocks('plant', ['2026-02-01']).slice(0, 2)
    const archive = buildBuildingArchive(
      makeState({ builds: partial, completedBlueprintIds: ['plant'] }),
      'plant',
    )
    expect(archive.completed).toBe(false)
    expect(archive.archivedAtUnknown).toBe(true)
    expect(archive.completedAt).toBeNull()
  })
})

describe('落成日、耗时与统计', () => {
  it('落成日 = max(placedAt) 本地日期；首块日 = min；耗时 = 首尾差（同日为 0）', () => {
    const blocks = makeBlocks('plant', ['2026-03-01', '2026-03-05', '2026-03-12'])
    const archive = buildBuildingArchive(makeState({ builds: blocks }), 'plant')
    expect(archive.completed).toBe(true)
    expect(archive.completedAt).toBe('2026-03-12')
    expect(archive.firstPlacedAt).toBe('2026-03-01')
    expect(archive.days).toBe(11)
    expect(archive.totalBlocks).toBe(blueprints.plant.blocks.length)
    expect(archive.ordinal).toBe(1)
    expect(archive.totalCompleted).toBe(1)
  })

  it('placedAt 是 ISO UTC：落成日按本地日期键而不是 UTC 日期', () => {
    const iso = '2026-03-12T20:00:00.000Z'
    const blocks = blueprints.plant.blocks.map((_, index) => ({
      id: 'p-' + index,
      blueprintId: 'plant',
      index,
      placedAt: iso,
      fromHabitId: 'h1',
      bonus: false,
    }))
    expect(completionDateOf(makeState({ builds: blocks }), 'plant')).toBe(
      // dateKey(new Date(iso)) —— 与实现的本地口径一致（不硬编码时区）
      (() => {
        const d = new Date(iso)
        const pad = (n: number) => String(n).padStart(2, '0')
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      })(),
    )
  })

  it('同日落成为 0 天；跨年建造取首尾差', () => {
    const sameDay = makeBlocks('plant', ['2026-06-01'])
    expect(buildBuildingArchive(makeState({ builds: sameDay }), 'plant').days).toBe(0)

    const crossYear = makeBlocks('plant', ['2025-12-20', '2025-12-28', '2026-01-05'])
    const archive = buildBuildingArchive(makeState({ builds: crossYear }), 'plant')
    expect(archive.completedAt).toBe('2026-01-05')
    expect(archive.firstPlacedAt).toBe('2025-12-20')
    expect(archive.days).toBe(16)
  })

  it('奖励块与全勤贡献块分别计数；全勤块不计入「投入最多习惯」', () => {
    const blocks = makeBlocks('plant', ['2026-03-01'], {
      1: { bonus: true, fromHabitId: '__day__' },
      3: { fromHabitId: '__day__' },
      5: { bonus: true },
    })
    const state = makeState({
      builds: blocks,
      habits: [habit('h1', { name: '晨间冥想' })],
    })
    const archive = buildBuildingArchive(state, 'plant')
    expect(archive.bonusBlocks).toBe(2)
    expect(archive.dayClaimBlocks).toBe(2)
    expect(archive.bonusByIndex[1]).toBe(true)
    expect(archive.bonusByIndex[5]).toBe(true)
    expect(archive.bonusByIndex[0]).toBe(false)
    // 其余块默认 h1；两块 __day__ 不计入「投入最多习惯」
    expect(archive.topHabits).toEqual([
      { habitId: 'h1', name: '晨间冥想', count: blueprints.plant.blocks.length - 2 },
    ])
  })

  it('无效 placedAt：块数达标但落成时间不可判定 → completedAt=null、不编日期', () => {
    const over: Record<number, Partial<PlacedBlock>> = {}
    blueprints.plant.blocks.forEach((_, index) => {
      over[index] = { placedAt: 'not-a-date' }
    })
    const blocks = makeBlocks('plant', ['2026-03-01'], over)
    const archive = buildBuildingArchive(makeState({ builds: blocks }), 'plant')
    expect(archive.completed).toBe(true)
    expect(archive.completedAt).toBeNull()
    expect(archive.days).toBeNull()
    expect(archive.ordinal).toBeNull()
  })
})

describe('投入最多的习惯', () => {
  it('按 fromHabitId 计数降序；并列按习惯 createdAt 升序；最多 3 个', () => {
    const habits = [
      habit('h1', { name: 'A', createdAt: '2024-01-01T00:00:00.000Z' }),
      habit('h2', { name: 'B', createdAt: '2024-01-02T00:00:00.000Z' }),
      habit('h3', { name: 'C', createdAt: '2024-01-03T00:00:00.000Z' }),
      habit('h4', { name: 'D', createdAt: '2024-01-04T00:00:00.000Z' }),
    ]
    // plant 6 块：h1=3、h2=1、h3=1、全勤=1
    const blocks = makeBlocks('plant', ['2026-03-01'], {
      0: { fromHabitId: 'h1' },
      1: { fromHabitId: 'h1' },
      2: { fromHabitId: 'h1' },
      3: { fromHabitId: 'h2' },
      4: { fromHabitId: 'h3' },
      5: { fromHabitId: '__day__' },
    })
    const archive = buildBuildingArchive(makeState({ builds: blocks, habits }), 'plant')
    const h1Count = blueprints.plant.blocks.length - 3 // 6 以后默认 h1，减去 __day__ 与 h2/h3 各 1
    expect(archive.topHabits.map((h) => h.habitId)).toEqual(['h1', 'h2', 'h3'])
    expect(archive.topHabit).toEqual({ habitId: 'h1', name: 'A', count: h1Count })
  })

  it('习惯已删除（存档里查不到名字）不崩，名字回退空串', () => {
    const blocks = makeBlocks('plant', ['2026-03-01'], {})
    const archive = buildBuildingArchive(makeState({ builds: blocks }), 'plant')
    expect(archive.topHabit?.habitId).toBe('h1')
    expect(archive.topHabit?.name).toBe('')
  })
})

describe('关键块与随笔时间线', () => {
  it('关键块锚点：首块 / 25% / 50% / 75% / 末块，按序位升序', () => {
    const archive = buildBuildingArchive(
      makeState({ builds: makeBlocks('plant', ['2026-03-01', '2026-03-12']) }),
      'plant',
    )
    const capacity = blueprints.plant.blocks.length
    // 独立复算锚点：首块 / 25% / 50% / 75% / 末块，按序位去重
    const expectedIndexes: number[] = []
    const expectedPercents: number[] = []
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const index = Math.round((capacity - 1) * fraction)
      if (expectedIndexes.includes(index)) continue
      expectedIndexes.push(index)
      expectedPercents.push(Math.round(fraction * 100))
    }
    expect(archive.milestones.map((m) => m.index)).toEqual(expectedIndexes)
    expect(archive.milestones[0].kind).toBe('first')
    expect(archive.milestones[archive.milestones.length - 1].kind).toBe('last')
    expect(archive.milestones.map((m) => m.percent)).toEqual(
      expectedPercents.map((percent, position) =>
        position === 0 || position === expectedPercents.length - 1 ? undefined : percent,
      ),
    )
    expect(archive.milestones[0].blockId).toBe('plant-0')
    expect(archive.milestones[archive.milestones.length - 1].blockId).toBe('plant-' + (capacity - 1))
  })

  it('小模型（2 块）锚点去重后只剩首块与末块', () => {
    ;(blueprints as unknown as Record<string, unknown>).__small__ = {
      id: '__small__',
      blocks: [
        { x: 0, y: 0, z: 0, type: 'basic' },
        { x: 0, y: 0, z: 1, type: 'basic' },
      ],
    }
    const builds: PlacedBlock[] = [
      { id: 's0', blueprintId: '__small__', index: 0, placedAt: atLocal('2026-01-01'), fromHabitId: 'h1', bonus: false },
      { id: 's1', blueprintId: '__small__', index: 1, placedAt: atLocal('2026-01-02'), fromHabitId: 'h1', bonus: false },
    ]
    const archive = buildBuildingArchive(makeState({ builds }), '__small__')
    expect(archive.milestones).toEqual([
      expect.objectContaining({ index: 0, kind: 'first' }),
      expect.objectContaining({ index: 1, kind: 'last' }),
    ])
  })

  it('关键块关联当天打卡的随笔/心境/星标；墓碑打卡不关联', () => {
    const blocks = makeBlocks('plant', ['2026-03-01', '2026-03-12'])
    const state = makeState({
      builds: blocks,
      habits: [habit('h1', { name: '晨间冥想' })],
      checkIns: [
        checkIn({
          id: 'c1',
          habitId: 'h1',
          date: '2026-03-01',
          placedBlockId: 'plant-0',
          note: '  第一块，窗外有雨。 ',
          mood: 'calm',
          starred: true,
        }),
        checkIn({
          id: 'c2',
          habitId: 'h1',
          date: '2026-03-02',
          placedBlockId: 'plant-1',
          note: '被撤销了',
          deletedAt: atLocal('2026-03-03'),
        }),
      ],
    })
    const archive = buildBuildingArchive(state, 'plant')
    const first = archive.milestones[0]
    expect(first.date).toBe('2026-03-01')
    expect(first.habitName).toBe('晨间冥想')
    expect(first.note).toBe('第一块，窗外有雨。')
    expect(first.mood).toBe('calm')
    expect(first.starred).toBe(true)
    expect(first.checkInId).toBe('c1')
    expect(archive.milestones[1].checkInId).toBeUndefined()
  })

  it('随笔时间线：排除墓碑与空随笔，按日期升序；blockMetaIndex 可直接查询', () => {
    const blocks = makeBlocks('plant', ['2026-03-01', '2026-03-12'])
    const state = makeState({
      builds: blocks,
      habits: [habit('h1', { name: '晨间冥想' })],
      checkIns: [
        checkIn({ id: 'c2', habitId: 'h1', date: '2026-03-05', placedBlockId: 'plant-3', note: '后来写的' }),
        checkIn({ id: 'c1', habitId: 'h1', date: '2026-03-02', placedBlockId: 'plant-2', note: '先写的' }),
        checkIn({ id: 'c3', habitId: 'h1', date: '2026-03-03', placedBlockId: 'plant-3', note: '   ' }),
        checkIn({
          id: 'c4',
          habitId: 'h1',
          date: '2026-03-04',
          placedBlockId: 'plant-3',
          note: '墓碑',
          deletedAt: atLocal('2026-03-06'),
        }),
      ],
    })
    const archive = buildBuildingArchive(state, 'plant')
    expect(archive.notes.map((n) => n.note)).toEqual(['先写的', '后来写的'])
    expect(archive.notes.map((n) => n.index)).toEqual([2, 3])
    const meta = blockMetaIndex(state, 'plant')
    expect(meta.get(2)?.ci?.id).toBe('c1')
    expect(meta.get(2)?.habitName).toBe('晨间冥想')
    expect(meta.get(4)?.ci).toBeUndefined()
  })
})

describe('第 N 座与建筑清单', () => {
  it('按落成时间升序编号；listArchiveBuildings 按落成时间倒序；跨年也参与排序', () => {
    const builds: PlacedBlock[] = [
      ...makeBlocks('coffee', ['2026-05-01']),
      ...makeBlocks('plant', ['2025-12-20']),
      ...makeBlocks('camera', ['2026-08-01']),
    ]
    const state = makeState({ builds })
    expect(buildBuildingArchive(state, 'plant').ordinal).toBe(1)
    expect(buildBuildingArchive(state, 'coffee').ordinal).toBe(2)
    expect(buildBuildingArchive(state, 'camera').ordinal).toBe(3)
    expect(buildBuildingArchive(state, 'camera').totalCompleted).toBe(3)
    expect(listArchiveBuildings(state)).toEqual(['camera', 'coffee', 'plant'])
  })

  it('未落成建筑 ordinal=null、不进 list；completedBlueprintIds 顺序不影响序号', () => {
    const builds = [...makeBlocks('plant', ['2026-03-01']), ...makeBlocks('coffee', ['2026-04-01'])].slice(
      0,
      blueprints.plant.blocks.length,
    )
    const state = makeState({ builds, completedBlueprintIds: ['coffee', 'plant'] })
    expect(buildBuildingArchive(state, 'plant').ordinal).toBe(1)
    expect(buildBuildingArchive(state, 'coffee').ordinal).toBeNull()
    expect(listArchiveBuildings(state)).toEqual(['plant'])
  })
})

describe('铭言、墓碑与口径交叉校验', () => {
  it('铭言 trim 后读取；空白铭言视为无', () => {
    expect(
      buildBuildingArchive(
        makeState({ builds: makeBlocks('plant', ['2026-03-01']), foundationNotes: { plant: '  从一颗种子开始。 ' } }),
        'plant',
      ).foundationNote,
    ).toBe('从一颗种子开始。')
    expect(
      buildBuildingArchive(
        makeState({ builds: makeBlocks('plant', ['2026-03-01']), foundationNotes: { plant: '   ' } }),
        'plant',
      ).foundationNote,
    ).toBeUndefined()
  })

  it('墓碑积木不计入块数（撤销后不再算落成）', () => {
    const blocks = makeBlocks('plant', ['2026-03-01'])
    blocks[5] = { ...blocks[5], deletedAt: atLocal('2026-03-02') }
    const archive = buildBuildingArchive(makeState({ builds: blocks }), 'plant')
    expect(archive.completed).toBe(false)
    expect(archive.totalBlocks).toBe(blueprints.plant.blocks.length - 1)
  })

  it('与 A2 yearbook.completionDateOf 口径一致（同一 fixture 交叉校验）', () => {
    const blocks = makeBlocks('coffee', ['2026-01-02', '2026-02-03'])
    const state = makeState({ builds: blocks })
    const full = { ...state, dayClaims: [], deletedDayClaims: [] }
    expect(completionDateOf(state, 'coffee')).toBe(yearbookCompletionDateOf(full, 'coffee'))
    expect(completionDateOf(state, 'plant')).toBeNull()
  })
})
