import { describe, it, expect } from 'vitest'
import { currentStreak, bestStreak } from './streak'
import type { Habit, CheckIn } from '../types'

const daily: Habit = {
  id: 'h1',
  name: '读书',
  frequency: { type: 'daily' },
  createdAt: '2026-08-01T00:00:00.000Z',
}
const weekly2: Habit = {
  id: 'h2',
  name: '健身',
  frequency: { type: 'weekly', times: 2 },
  createdAt: '2026-08-01T00:00:00.000Z',
}
const customMWF: Habit = {
  id: 'h3',
  name: '健身房',
  frequency: { type: 'custom', days: [1, 3, 5] }, // 周一、周三、周五
  createdAt: '2026-08-01T00:00:00.000Z',
}
function ci(habitId: string, date: string): CheckIn {
  return { id: `${habitId}-${date}`, habitId, date, at: `${date}T12:00:00.000Z` }
}

describe('currentStreak (daily)', () => {
  it('counts consecutive days ending today', () => {
    const cs = [ci('h1', '2026-08-20'), ci('h1', '2026-08-21'), ci('h1', '2026-08-22')]
    expect(currentStreak(daily, cs, new Date(2026, 7, 22))).toBe(3)
  })

  it('today missing counts from yesterday', () => {
    const cs = [ci('h1', '2026-08-20'), ci('h1', '2026-08-21')]
    expect(currentStreak(daily, cs, new Date(2026, 7, 22))).toBe(2)
  })

  it('gap resets to the run just before today', () => {
    const cs = [ci('h1', '2026-08-18'), ci('h1', '2026-08-19'), ci('h1', '2026-08-21')]
    expect(currentStreak(daily, cs, new Date(2026, 7, 22))).toBe(1)
  })

  it('no check-ins → 0', () => {
    expect(currentStreak(daily, [], new Date(2026, 7, 22))).toBe(0)
  })

  it('ignores other habits check-ins', () => {
    const cs = [ci('h2', '2026-08-22')]
    expect(currentStreak(daily, cs, new Date(2026, 7, 22))).toBe(0)
  })
})

describe('currentStreak (weekly)', () => {
  it('counts consecutive fully-met weeks, current week counts if met', () => {
    // 本周 8-17~8-23 已 2 次，上周 8-10~8-16 已 2 次
    const cs = [
      ci('h2', '2026-08-18'), ci('h2', '2026-08-20'),
      ci('h2', '2026-08-11'), ci('h2', '2026-08-13'),
    ]
    expect(currentStreak(weekly2, cs, new Date(2026, 7, 22))).toBe(2)
  })

  it('current week in progress does not break streak', () => {
    const cs = [
      ci('h2', '2026-08-18'),
      ci('h2', '2026-08-11'), ci('h2', '2026-08-13'),
    ]
    expect(currentStreak(weekly2, cs, new Date(2026, 7, 22))).toBe(1)
  })

  it('a missed full week breaks streak', () => {
    const cs = [
      ci('h2', '2026-08-18'), ci('h2', '2026-08-20'),
      // 8-10~8-16 空
      ci('h2', '2026-08-03'), ci('h2', '2026-08-05'),
    ]
    expect(currentStreak(weekly2, cs, new Date(2026, 7, 22))).toBe(1)
  })
})

describe('currentStreak (custom weekdays)', () => {
  it('rest days do not break streak', () => {
    // 2026-08-17(周一), 08-19(周三), 08-21(周五)
    const cs = [
      ci('h3', '2026-08-17'),
      ci('h3', '2026-08-19'),
      ci('h3', '2026-08-21'),
    ]
    // 周六 8-22 查看：昨天的周五已完成，周二/周四休息日不中断连击 → streak = 3
    expect(currentStreak(customMWF, cs, new Date(2026, 7, 22))).toBe(3)
  })

  it('missing a scheduled day resets streak', () => {
    // 周一未打，周三、周五打了
    const cs = [ci('h3', '2026-08-19'), ci('h3', '2026-08-21')]
    expect(currentStreak(customMWF, cs, new Date(2026, 7, 22))).toBe(2)
  })
})

describe('bestStreak', () => {
  it('daily: finds longest historical run', () => {
    const cs = [
      ci('h1', '2026-08-01'), ci('h1', '2026-08-02'), ci('h1', '2026-08-03'),
      ci('h1', '2026-08-04'),
      ci('h1', '2026-08-10'), ci('h1', '2026-08-11'),
    ]
    expect(bestStreak(daily, cs)).toBe(4)
  })

  it('weekly: finds longest run of met weeks', () => {
    const cs = [
      ci('h2', '2026-08-18'), ci('h2', '2026-08-20'),
      ci('h2', '2026-08-11'), ci('h2', '2026-08-13'),
      ci('h2', '2026-07-27'),
    ]
    // 8-17周 met, 8-10周 met, 7-27周 只有1次未达标 → best=2
    expect(bestStreak(weekly2, cs)).toBe(2)
  })
})
