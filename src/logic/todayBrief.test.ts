import { describe, expect, it } from 'vitest'
import { buildTodayBrief, greetingForHour } from './todayBrief'
import { blueprintOrder, getBlueprint } from './blueprints'
import type { CheckIn, Habit } from '../types'

const DAY = '2026-11-10'

function habit(id: string, over: Partial<Habit> = {}): Habit {
  return {
    id,
    name: id,
    frequency: { type: 'daily' },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over
  }
}

function checkIn(habitId: string, date = DAY): CheckIn {
  return { id: `c-${habitId}-${date}`, habitId, date, at: `${date}T08:00:00.000Z` }
}

function brief(
  habits: Habit[],
  checkIns: CheckIn[] = [],
  placed = 0,
  hour = 9,
  activeBlueprintId = 'plant'
) {
  return buildTodayBrief({
    now: new Date(2026, 10, 10, hour, 0, 0),
    day: DAY,
    habits,
    checkIns,
    builds: Array.from({ length: placed }, () => ({ blueprintId: activeBlueprintId })),
    activeBlueprintId
  })
}

describe('greetingForHour', () => {
  it('covers all boundary hours', () => {
    expect(greetingForHour(4)).toBe('night')
    expect(greetingForHour(5)).toBe('morning')
    expect(greetingForHour(10)).toBe('morning')
    expect(greetingForHour(11)).toBe('noon')
    expect(greetingForHour(13)).toBe('noon')
    expect(greetingForHour(14)).toBe('afternoon')
    expect(greetingForHour(17)).toBe('afternoon')
    expect(greetingForHour(18)).toBe('evening')
    expect(greetingForHour(22)).toBe('evening')
    expect(greetingForHour(23)).toBe('night')
    expect(greetingForHour(0)).toBe('night')
  })
})

describe('buildTodayBrief', () => {
  it('hides when there are no active habits', () => {
    const state = brief([])
    expect(state.show).toBe(false)
    expect(state.total).toBe(0)
    expect(state.firstPendingHabitId).toBeUndefined()
  })

  it('counts done/pending and picks the first pending in display order', () => {
    const habits = [
      habit('evening-pinned', { period: 'evening', pinned: true }),
      habit('any-first', { period: 'any' }),
      habit('any-done', { period: 'any' })
    ]
    const state = brief(habits, [checkIn('any-done')])
    expect(state.show).toBe(true)
    expect(state.total).toBe(3)
    expect(state.done).toBe(1)
    expect(state.pending).toBe(2)
    // 今日页先渲染 any 分组，再渲染 evening 分组；置顶只在组内优先
    expect(state.firstPendingHabitId).toBe('any-first')
  })

  it('prefers pinned habit inside the same period', () => {
    const state = brief([habit('a'), habit('b', { pinned: true })])
    expect(state.firstPendingHabitId).toBe('b')
  })

  it('hides when everything is done for today', () => {
    const state = brief([habit('a'), habit('b')], [checkIn('a'), checkIn('b')])
    expect(state.show).toBe(false)
    expect(state.done).toBe(2)
    expect(state.pending).toBe(0)
  })

  it('counts rest-day custom habits as met (same rule as habitMetOnDay)', () => {
    const restDay = habit('rest', { frequency: { type: 'custom', days: [1] } }) // 周一；DAY 是周二
    const state = brief([restDay, habit('work')])
    expect(state.done).toBe(1)
    expect(state.firstPendingHabitId).toBe('work')
  })

  it('uses the filtered target habits for the CTA (category filter)', () => {
    const habits = [habit('a'), habit('b')]
    const state = buildTodayBrief({
      now: new Date(2026, 10, 10, 9, 0, 0),
      day: DAY,
      habits,
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      targetHabits: [habits[1]]
    })
    // 计数仍是全量，但「开始第一个」只指向当前筛选下可见的那件
    expect(state.total).toBe(2)
    expect(state.firstPendingHabitId).toBe('b')
  })

  it('skips completed blueprints when suggesting the next one', () => {
    const full = getBlueprint('castle').blocks.length
    const completed = [blueprintOrder[1], blueprintOrder[2]]
    const state = buildTodayBrief({
      now: new Date(2026, 10, 10, 9, 0, 0),
      day: DAY,
      habits: [habit('a')],
      checkIns: [],
      builds: Array.from({ length: full }, () => ({ blueprintId: 'castle' })),
      activeBlueprintId: 'castle',
      completedBlueprintIds: completed
    })
    expect(state.nextBlueprintId).not.toBe(blueprintOrder[1])
    expect(state.nextBlueprintId).not.toBe(blueprintOrder[2])
    // 12 座全部落成时不再给出「下一座」
    const allDone = buildTodayBrief({
      now: new Date(2026, 10, 10, 9, 0, 0),
      day: DAY,
      habits: [habit('a')],
      checkIns: [],
      builds: Array.from({ length: full }, () => ({ blueprintId: 'castle' })),
      activeBlueprintId: 'castle',
      completedBlueprintIds: [...blueprintOrder]
    })
    expect(allDone.nextBlueprintId).toBeUndefined()
  })

  it('reports remaining blocks and the next blueprint when the current one is full', () => {
    const full = getBlueprint('plant').blocks.length
    const partial = brief([habit('a')], [], 3)
    expect(partial.remainingBlocks).toBe(full - 3)
    expect(partial.nextBlueprintId).toBeUndefined()

    const ready = brief([habit('a')], [], full)
    expect(ready.remainingBlocks).toBe(0)
    expect(ready.nextBlueprintId).toBe(blueprintOrder[1])
  })
})
