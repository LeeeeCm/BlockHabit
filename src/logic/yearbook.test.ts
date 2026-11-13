import { describe, expect, it } from 'vitest'
import type { CheckIn, DayClaim, Habit, PlacedBlock } from '../types'
import { zh } from '../i18n/locales/zh'
import { en } from '../i18n/locales/en'
import { blueprints } from './blueprints'
import { dateKey } from './dates'
import {
  availableYears,
  buildYearbook,
  completionDateOf,
  formatPeakHour,
  yearbookMarkdown,
  yearbookSummaryText,
  type YearbookState
} from './yearbook'

/**
 * 落成年鉴逻辑（D-20261110-060 / 技术笔记 §2.3）：
 * 空数据、跨年、墓碑、闰年、建筑年表、Top 习惯并列、随笔挑选、最长全勤连击。
 * 全部由 AppState 派生，零新字段。
 */

const CREATED = '2026-01-01T08:00:00.000Z'

function makeHabit(id: string, overrides: Partial<Habit> = {}): Habit {
  return { id, name: id, frequency: { type: 'daily' }, createdAt: CREATED, ...overrides }
}

/** 构造“本地某天某时刻”的 ISO 时间戳，避免测试依赖机器时区 */
function atLocal(date: string, hour = 8, minute = 0): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

function makeCheckIn(
  id: string,
  habitId: string,
  date: string,
  overrides: Partial<CheckIn> = {}
): CheckIn {
  return { id, habitId, date, at: atLocal(date), ...overrides }
}

function makeClaim(date: string, overrides: Partial<DayClaim> = {}): DayClaim {
  return {
    date,
    claimedAt: atLocal(date, 21),
    blockId: `block-${date}`,
    blueprintId: 'plant',
    ...overrides
  }
}

/** 用某蓝图真实容量生成一组积木（日期循环取用） */
function makeBlocks(blueprintId: string, dates: string[]): PlacedBlock[] {
  const blueprint = blueprints[blueprintId]
  return blueprint.blocks.map((_, index) => ({
    id: `${blueprintId}-${index}`,
    blueprintId,
    index,
    placedAt: atLocal(dates[Math.min(index, dates.length - 1)], 12),
    fromHabitId: 'h1',
    bonus: false
  }))
}

function makeState(overrides: Partial<YearbookState> = {}): YearbookState {
  return {
    habits: [],
    checkIns: [],
    builds: [],
    dayClaims: [],
    deletedDayClaims: [],
    foundationNotes: {},
    completedBlueprintIds: [],
    ...overrides
  }
}

describe('availableYears', () => {
  it('从打卡/积木/全勤事实派生并降序去重，忽略墓碑', () => {
    const state = makeState({
      checkIns: [
        makeCheckIn('c1', 'h1', '2026-03-01'),
        makeCheckIn('c2', 'h1', '2026-03-02'),
        makeCheckIn('c3', 'h1', '2024-06-01'),
        makeCheckIn('c4', 'h1', '2023-06-01', { deletedAt: atLocal('2023-06-02') })
      ],
      builds: [
        ...makeBlocks('plant', ['2025-12-30']),
        {
          id: 'deleted-block',
          blueprintId: 'plant',
          index: 0,
          placedAt: atLocal('2020-01-05', 12),
          fromHabitId: 'h1',
          bonus: false,
          deletedAt: atLocal('2020-01-06')
        }
      ],
      dayClaims: [makeClaim('2022-05-01')]
    })
    expect(availableYears(state)).toEqual([2026, 2025, 2024, 2022])
  })

  it('空数据返回空数组', () => {
    expect(availableYears(makeState())).toEqual([])
  })
})

describe('buildYearbook 空数据', () => {
  it('hasData=false，12 个月结构完整，所有统计为 0，不伪造数字', () => {
    const model = buildYearbook(makeState(), 2026)
    expect(model.hasData).toBe(false)
    expect(model.year).toBe(2026)
    expect(model.stats).toEqual({
      checkIns: 0,
      blocks: 0,
      completedBuildings: 0,
      perfectDays: 0,
      longestStreak: 0,
      focusMinutes: 0,
      notes: 0
    })
    expect(model.months).toHaveLength(12)
    expect(model.months[1].days).toHaveLength(28)
    expect(model.buildings).toEqual([])
    expect(model.quote).toBeNull()
    expect(model.timeShape).toEqual({ peakHour: null, peakWeekday: null, topHabits: [] })
  })

  it('只有习惯、没有任何事实数据时 hasData=false', () => {
    const model = buildYearbook(makeState({ habits: [makeHabit('h1')] }), 2026)
    expect(model.hasData).toBe(false)
  })
})

describe('墓碑与时间口径', () => {
  it('删除的打卡/积木/全勤不计入任何统计', () => {
    const state = makeState({
      habits: [makeHabit('h1')],
      checkIns: [
        makeCheckIn('c1', 'h1', '2026-02-01', { actualMinutes: 30, note: '留下' }),
        makeCheckIn('c2', 'h1', '2026-02-02', {
          actualMinutes: 50,
          note: '被撤销',
          deletedAt: atLocal('2026-02-03')
        })
      ],
      builds: [
        {
          id: 'b1',
          blueprintId: 'plant',
          index: 0,
          placedAt: atLocal('2026-02-01', 12),
          fromHabitId: 'h1',
          bonus: false
        },
        {
          id: 'b2',
          blueprintId: 'plant',
          index: 1,
          placedAt: atLocal('2026-02-02', 12),
          fromHabitId: 'h1',
          bonus: false,
          deletedAt: atLocal('2026-02-03')
        }
      ],
      dayClaims: [makeClaim('2026-02-01'), makeClaim('2026-02-02')],
      deletedDayClaims: [{ date: '2026-02-02', deletedAt: atLocal('2026-02-03', 22) }]
    })
    const model = buildYearbook(state, 2026)
    expect(model.stats.checkIns).toBe(1)
    expect(model.stats.blocks).toBe(1)
    expect(model.stats.perfectDays).toBe(1)
    expect(model.stats.longestStreak).toBe(1)
    expect(model.stats.focusMinutes).toBe(30)
    expect(model.stats.notes).toBe(1)
  })

  it('全勤墓碑按 claimedAt/deletedAt 时间 LWW：晚于撤销的重新领取有效', () => {
    const state = makeState({
      dayClaims: [
        {
          date: '2026-01-01',
          claimedAt: atLocal('2026-01-02', 9),
          blockId: 'b',
          blueprintId: 'plant'
        }
      ],
      deletedDayClaims: [{ date: '2026-01-01', deletedAt: atLocal('2026-01-01', 23) }]
    })
    expect(buildYearbook(state, 2026).stats.perfectDays).toBe(1)
  })

  it('跨年：只统计目标年，年份边界按本地日期键', () => {
    const state = makeState({
      habits: [makeHabit('h1')],
      checkIns: [
        makeCheckIn('a', 'h1', '2025-12-31'),
        makeCheckIn('b', 'h1', '2026-01-01'),
        makeCheckIn('c', 'h1', '2026-12-31'),
        makeCheckIn('d', 'h1', '2027-01-01')
      ]
    })
    const model = buildYearbook(state, 2026)
    expect(model.stats.checkIns).toBe(2)
    expect(model.months[0].checkIns).toBe(1)
    expect(model.months[11].checkIns).toBe(1)
    expect(availableYears(state)).toEqual([2027, 2026, 2025])
  })
})

describe('闰年与月度完成度', () => {
  it('闰年 2 月 29 天，平年 28 天', () => {
    expect(buildYearbook(makeState(), 2028).months[1].days).toHaveLength(29)
    expect(buildYearbook(makeState(), 2026).months[1].days).toHaveLength(28)
    expect(buildYearbook(makeState(), 2028).months[1].days[28].key).toBe('2028-02-29')
  })

  it('月度完成度用 dayCompletionRatio：无在册习惯为 -1，未来日标记 future', () => {
    const habit = makeHabit('h1', { createdAt: '2026-03-10T08:00:00.000Z' })
    const now = new Date(2026, 2, 20, 12, 0, 0)
    const model = buildYearbook(
      makeState({ habits: [habit], checkIns: [makeCheckIn('c1', 'h1', '2026-03-12')] }),
      2026,
      now
    )
    const days = model.months[2].days
    expect(days[0].ratio).toBe(-1) // 3-01 习惯尚未创建
    expect(days[11].ratio).toBe(1) // 3-12 已打卡
    expect(days[11].future).toBe(false)
    expect(days[19].ratio).toBe(0) // 3-20 应执行未打卡
    expect(days[20].future).toBe(true) // 3-21 未来
    expect(days[0].future).toBe(false)
  })

  it('月份打卡数与全勤标记来自事实', () => {
    const state = makeState({
      habits: [makeHabit('h1')],
      checkIns: [makeCheckIn('c1', 'h1', '2026-05-01'), makeCheckIn('c2', 'h1', '2026-05-02')],
      dayClaims: [makeClaim('2026-05-01')]
    })
    const model = buildYearbook(state, 2026)
    expect(model.months[4].checkIns).toBe(2)
    expect(model.months[4].days[0].claimed).toBe(true)
    expect(model.months[4].days[1].claimed).toBe(false)
  })
})

describe('建筑年表', () => {
  it('块数达标才落成：落成日 = max(placedAt) 本地日期，含铭言与建造天数', () => {
    const state = makeState({
      builds: makeBlocks('plant', ['2026-03-01', '2026-03-05', '2026-03-12']),
      foundationNotes: { plant: '  从一颗种子开始。 ' }
    })
    const model = buildYearbook(state, 2026)
    expect(model.buildings).toHaveLength(1)
    const entry = model.buildings[0]
    expect(entry.blueprintId).toBe('plant')
    expect(entry.completedAt).toBe('2026-03-12')
    expect(entry.firstPlacedAt).toBe('2026-03-01')
    expect(entry.blocks).toBe(blueprints.plant.blocks.length)
    expect(entry.days).toBe(12) // 3-01 → 3-12 含首尾
    expect(entry.foundationNote).toBe('从一颗种子开始。')
    expect(model.stats.completedBuildings).toBe(1)
  })

  it('块数不足（旧档/撤销）不算落成，即使 completedBlueprintIds 里有它', () => {
    const partial = makeBlocks('plant', ['2026-03-01']).slice(0, blueprints.plant.blocks.length - 1)
    const state = makeState({ builds: partial, completedBlueprintIds: ['plant'] })
    expect(completionDateOf(state, 'plant')).toBeNull()
    expect(buildYearbook(state, 2026).buildings).toEqual([])
    expect(buildYearbook(state, 2026).stats.completedBuildings).toBe(0)
  })

  it('未知蓝图 id 不伪造落成日期', () => {
    const state = makeState({
      builds: [
        {
          id: 'u1',
          blueprintId: 'unknown-blueprint',
          index: 0,
          placedAt: atLocal('2026-05-01', 12),
          fromHabitId: 'h1',
          bonus: false
        }
      ]
    })
    expect(completionDateOf(state, 'unknown-blueprint')).toBeNull()
  })

  it('只收录落成在目标年的建筑（跨年按落成日归属）', () => {
    const state = makeState({ builds: makeBlocks('plant', ['2025-12-28', '2025-12-31']) })
    expect(buildYearbook(state, 2025).buildings.map((b) => b.blueprintId)).toEqual(['plant'])
    expect(buildYearbook(state, 2026).buildings).toEqual([])
  })

  it('多座建筑按落成日升序排列', () => {
    const state = makeState({
      builds: [...makeBlocks('coffee', ['2026-06-01']), ...makeBlocks('plant', ['2026-02-01'])]
    })
    const model = buildYearbook(state, 2026)
    expect(model.buildings.map((b) => b.blueprintId)).toEqual(['plant', 'coffee'])
  })

  it('placedAt 是 ISO UTC：落成日按本地日期键而不是 UTC 日期', () => {
    const iso = '2026-03-12T20:00:00.000Z'
    const blocks = blueprints.plant.blocks.map((_, index) => ({
      id: `p-${index}`,
      blueprintId: 'plant',
      index,
      placedAt: iso,
      fromHabitId: 'h1',
      bonus: false
    }))
    expect(completionDateOf(makeState({ builds: blocks }), 'plant')).toBe(dateKey(new Date(iso)))
  })
})

describe('时间形状', () => {
  it('Top3 习惯：按当年打卡数降序，并列按 createdAt 升序，最多 3 个', () => {
    const habits = [
      makeHabit('h1', { name: 'A', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeHabit('h2', { name: 'B', createdAt: '2026-01-02T00:00:00.000Z' }),
      makeHabit('h3', { name: 'C', createdAt: '2026-01-03T00:00:00.000Z' }),
      makeHabit('h4', { name: 'D', createdAt: '2026-01-04T00:00:00.000Z' })
    ]
    const checkIns = [
      makeCheckIn('c1', 'h1', '2026-02-01'),
      makeCheckIn('c2', 'h1', '2026-02-02'),
      makeCheckIn('c3', 'h2', '2026-02-01'),
      makeCheckIn('c4', 'h2', '2026-02-02'),
      makeCheckIn('c5', 'h3', '2026-02-01'),
      makeCheckIn('c6', 'h4', '2026-02-01'),
      makeCheckIn('c7', 'h4', '2026-02-02'),
      makeCheckIn('c8', 'h4', '2026-02-03')
    ]
    const model = buildYearbook(makeState({ habits, checkIns }), 2026)
    expect(model.timeShape.topHabits).toEqual([
      { habitId: 'h4', name: 'D', count: 3 },
      { habitId: 'h1', name: 'A', count: 2 },
      { habitId: 'h2', name: 'B', count: 2 }
    ])
  })

  it('已归档习惯的历史打卡仍计入 Top 习惯（归档不删历史）', () => {
    const habit = makeHabit('h1', {
      name: '已归档',
      archivedAt: '2026-03-01T00:00:00.000Z'
    })
    const model = buildYearbook(
      makeState({ habits: [habit], checkIns: [makeCheckIn('c1', 'h1', '2026-02-01')] }),
      2026
    )
    expect(model.timeShape.topHabits[0]).toEqual({ habitId: 'h1', name: '已归档', count: 1 })
  })

  it('最常星期/时段按打卡计数，并列取更早的星期/时刻', () => {
    const checkIns = [
      makeCheckIn('c1', 'h1', '2026-02-02', { at: atLocal('2026-02-02', 8) }),
      makeCheckIn('c2', 'h1', '2026-02-03', { at: atLocal('2026-02-03', 8) }),
      makeCheckIn('c3', 'h1', '2026-02-04', { at: atLocal('2026-02-04', 21) }),
      makeCheckIn('c4', 'h1', '2026-02-05', { at: atLocal('2026-02-05', 21) })
    ]
    const model = buildYearbook(makeState({ habits: [makeHabit('h1')], checkIns }), 2026)
    expect(model.timeShape.peakHour).toBe(8)
    expect(model.timeShape.peakWeekday).toBe(1)
  })

  it('formatPeakHour 输出与语言无关的时刻', () => {
    expect(formatPeakHour(8)).toBe('08:00')
    expect(formatPeakHour(0)).toBe('00:00')
    expect(formatPeakHour(null)).toBe('')
  })
})

describe('当年一句随笔', () => {
  it('星标优先，其次更长，带习惯名与日期', () => {
    const habits = [makeHabit('h1', { name: '读书' })]
    const state = makeState({
      habits,
      checkIns: [
        makeCheckIn('c1', 'h1', '2026-04-01', { note: '普通但很长很长很长的一段话' }),
        makeCheckIn('c2', 'h1', '2026-04-02', { note: '短', starred: true }),
        makeCheckIn('c3', 'h1', '2026-04-03', { note: '另一个普通' })
      ]
    })
    expect(buildYearbook(state, 2026).quote).toEqual({
      text: '短',
      habitName: '读书',
      date: '2026-04-02',
      starred: true
    })
  })

  it('无星标时选最长；等长时选更早的日期', () => {
    const habits = [makeHabit('h1', { name: '冥想' })]
    const state = makeState({
      habits,
      checkIns: [
        makeCheckIn('c1', 'h1', '2026-04-05', { note: '一二三四五' }),
        makeCheckIn('c2', 'h1', '2026-04-01', { note: '甲乙丙丁戊' }),
        makeCheckIn('c3', 'h1', '2026-04-03', { note: '短句' })
      ]
    })
    const quote = buildYearbook(state, 2026).quote
    expect(quote?.text).toBe('甲乙丙丁戊')
    expect(quote?.date).toBe('2026-04-01')
  })

  it('空白随笔不算；没有随笔时为 null；只从当年挑选', () => {
    const habits = [makeHabit('h1', { name: '读书' })]
    const state = makeState({
      habits,
      checkIns: [
        makeCheckIn('c1', 'h1', '2026-04-01', { note: '   ' }),
        makeCheckIn('c2', 'h1', '2025-04-01', { note: '去年的随笔' })
      ]
    })
    expect(buildYearbook(state, 2026).quote).toBeNull()
    expect(buildYearbook(state, 2025).quote?.text).toBe('去年的随笔')
  })
})

describe('最长全勤连击与专注', () => {
  it('连续领取全勤的最长天数；跨年只在当年切片内计算', () => {
    const dates = [
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06'
    ]
    const state = makeState({ dayClaims: dates.map((date) => makeClaim(date)) })
    const model = buildYearbook(state, 2026)
    expect(model.stats.perfectDays).toBe(5)
    expect(model.stats.longestStreak).toBe(3)
  })

  it('专注分钟只累加 actualMinutes（targetMinutes 不算事实）', () => {
    const habit = makeHabit('h1', { kind: 'focus', targetMinutes: 25 })
    const state = makeState({
      habits: [habit],
      checkIns: [
        makeCheckIn('c1', 'h1', '2026-02-01', { actualMinutes: 20 }),
        makeCheckIn('c2', 'h1', '2026-02-02', { actualMinutes: 30 }),
        makeCheckIn('c3', 'h1', '2026-02-03'),
        makeCheckIn('c4', 'h1', '2026-02-04', { actualMinutes: -5 })
      ]
    })
    expect(buildYearbook(state, 2026).stats.focusMinutes).toBe(50)
  })
})

describe('摘要与 Markdown 导出', () => {
  const state = makeState({
    habits: [makeHabit('h1', { name: '晨间冥想' })],
    checkIns: [
      makeCheckIn('c1', 'h1', '2026-03-01', { note: '窗外有雨。' }),
      makeCheckIn('c2', 'h1', '2026-03-02')
    ],
    builds: makeBlocks('plant', ['2026-03-01', '2026-03-12']),
    dayClaims: [makeClaim('2026-03-01'), makeClaim('2026-03-02')],
    foundationNotes: { plant: '从一颗种子开始。' }
  })

  it('yearbookSummaryText 含年份、统计与建筑名（zh / en 各自语言）', () => {
    const model = buildYearbook(state, 2026)
    const summaryZh = yearbookSummaryText(model, zh)
    expect(summaryZh).toContain('2026')
    expect(summaryZh).toContain(zh.yearbook.metrics.checkIns)
    expect(summaryZh).toContain(zh.blueprints.plant)
    expect(summaryZh).toContain(zh.yearbook.sections.quote)

    const summaryEn = yearbookSummaryText(model, en)
    expect(summaryEn).toContain(en.yearbook.metrics.checkIns)
    expect(summaryEn).toContain(en.blueprints.plant)
  })

  it('空年份摘要使用诚实空态文案', () => {
    const summary = yearbookSummaryText(buildYearbook(makeState(), 2026), zh)
    expect(summary).toContain(zh.yearbook.emptyTitle)
    expect(summary).not.toContain(zh.yearbook.metrics.checkIns)
  })

  it('Markdown 可独立阅读：标题/统计/建筑年表/Top 习惯/随笔/来源说明', () => {
    const md = yearbookMarkdown(buildYearbook(state, 2026), zh, '2026-11-10')
    expect(md).toContain(`# ${zh.yearbook.markdownHeading(2026)}`)
    expect(md).toContain(`## ${zh.yearbook.sections.overview}`)
    expect(md).toContain(`- **${zh.yearbook.metrics.checkIns}**: 2`)
    expect(md).toContain(`## ${zh.yearbook.sections.buildings}`)
    expect(md).toContain(zh.blueprints.plant)
    expect(md).toContain('2026-03-12')
    expect(md).toContain('从一颗种子开始。')
    expect(md).toContain(`## ${zh.yearbook.sections.shape}`)
    expect(md).toContain(`## ${zh.yearbook.sections.quote}`)
    expect(md).toContain('窗外有雨。')
    expect(md).toContain(zh.stats.exportDate)
    expect(md).toContain('2026-11-10')
  })

  it('en Markdown 使用英文文案', () => {
    const md = yearbookMarkdown(buildYearbook(state, 2026), en, '2026-11-10')
    expect(md).toContain(`# ${en.yearbook.markdownHeading(2026)}`)
    expect(md).toContain(`## ${en.yearbook.sections.buildings}`)
    expect(md).toContain(en.yearbook.metrics.checkIns)
  })

  it('空年份 Markdown 只有空态与来源，不生成统计假数字', () => {
    const md = yearbookMarkdown(buildYearbook(makeState(), 2026), zh, '2026-11-10')
    expect(md).toContain(zh.yearbook.emptyTitle)
    expect(md).not.toContain(zh.yearbook.metrics.checkIns)
  })
})
