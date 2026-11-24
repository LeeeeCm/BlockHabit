import { describe, it, expect } from 'vitest'
import { canCheckIn, weekCountFor, habitMetOnDay, habitDoneOnDay, isDayComplete } from './checkin'
import type { Habit, CheckIn } from '../types'

const daily: Habit = {
  id: 'h1',
  name: '读书',
  frequency: { type: 'daily' },
  createdAt: '2026-08-01T00:00:00.000Z'
}
const weekly3: Habit = {
  id: 'h2',
  name: '健身',
  frequency: { type: 'weekly', times: 3 },
  createdAt: '2026-08-01T00:00:00.000Z'
}
const weekdays: Habit = {
  id: 'h4',
  name: '上班',
  frequency: { type: 'custom', days: [1, 2, 3, 4, 5] },
  createdAt: '2026-08-01T00:00:00.000Z'
}

function ci(habitId: string, date: string): CheckIn {
  return { id: `${habitId}-${date}`, habitId, date, at: `${date}T12:00:00.000Z` }
}

describe('canCheckIn', () => {
  it('ok for daily habit with no check-in today', () => {
    const r = canCheckIn([daily], [], 'h1', '2026-08-22')
    expect(r).toEqual({ ok: true })
  })

  it('rejects unknown habit', () => {
    expect(canCheckIn([], [], 'nope', '2026-08-22')).toEqual({ ok: false, reason: 'no-habit' })
  })

  it('rejects archived habit', () => {
    const archived = { ...daily, archivedAt: '2026-08-20T00:00:00.000Z' }
    expect(canCheckIn([archived], [], 'h1', '2026-08-22')).toEqual({
      ok: false,
      reason: 'archived'
    })
  })

  it('rejects same-day repeat (daily)', () => {
    const r = canCheckIn([daily], [ci('h1', '2026-08-22')], 'h1', '2026-08-22')
    expect(r).toEqual({ ok: false, reason: 'already' })
  })

  it('weekly: ok before quota, rejects at quota', () => {
    const week = [ci('h2', '2026-08-17'), ci('h2', '2026-08-18')]
    expect(canCheckIn([weekly3], week, 'h2', '2026-08-19').ok).toBe(true)
    const full = [...week, ci('h2', '2026-08-19')]
    // 8-19 已打过，但用另一天验证周频上限
    expect(canCheckIn([weekly3], full, 'h2', '2026-08-20')).toEqual({
      ok: false,
      reason: 'weekly-full'
    })
  })

  it('weekly: previous week does not count toward this week', () => {
    const prev = [ci('h2', '2026-08-10'), ci('h2', '2026-08-11'), ci('h2', '2026-08-12')]
    expect(canCheckIn([weekly3], prev, 'h2', '2026-08-19').ok).toBe(true)
  })

  it('weekly counter: quota full but day target unmet → still allowed to step', () => {
    const weeklyCounter: Habit = {
      id: 'h3',
      name: '喝水',
      frequency: { type: 'weekly', times: 2 },
      kind: 'counter',
      targetValue: 2000,
      step: 250,
      unit: 'ml',
      createdAt: '2026-08-01T00:00:00.000Z'
    }
    // 本周配额已用满（周内已有 2 次步进），当日数值尚未达标
    const fullWeek = [
      {
        id: 'h3-08-17',
        habitId: 'h3',
        date: '2026-08-17',
        at: '2026-08-17T12:00:00.000Z',
        value: 500
      },
      {
        id: 'h3-08-18',
        habitId: 'h3',
        date: '2026-08-18',
        at: '2026-08-18T12:00:00.000Z',
        value: 500
      }
    ]
    // counter 的"完成"以当日 targetValue 为准，周配额不拦截步进
    expect(canCheckIn([weeklyCounter], fullWeek, 'h3', '2026-08-20')).toEqual({ ok: true })
    // 当日达标后即视为完成，全勤判定一致
    const metDay = [
      ...fullWeek,
      {
        id: 'h3-08-20',
        habitId: 'h3',
        date: '2026-08-20',
        at: '2026-08-20T12:00:00.000Z',
        value: 2000
      }
    ]
    expect(habitMetOnDay(weeklyCounter, metDay, '2026-08-20')).toBe(true)
    expect(isDayComplete([weeklyCounter], metDay, '2026-08-20')).toBe(true)
  })
})

describe('weekCountFor', () => {
  it('counts only this week', () => {
    const cs = [
      ci('h2', '2026-08-16'),
      ci('h2', '2026-08-17'),
      ci('h2', '2026-08-18'),
      ci('h2', '2026-08-22')
    ]
    // 8-16 属于上周（周日），8-22 属于本周（周六）
    expect(weekCountFor(cs, 'h2', '2026-08-22')).toBe(3)
  })
})

describe('habitMetOnDay（周频）', () => {
  it('today check-in counts as met even before weekly quota', () => {
    const cs = [ci('h2', '2026-08-17')]
    expect(habitMetOnDay(weekly3, cs, '2026-08-17')).toBe(true)
    // 同周未打卡的另一天仍是未完成
    expect(habitMetOnDay(weekly3, cs, '2026-08-18')).toBe(false)
  })

  it('week quota met keeps remaining days completed', () => {
    const cs = [ci('h2', '2026-08-17'), ci('h2', '2026-08-18'), ci('h2', '2026-08-19')]
    expect(habitMetOnDay(weekly3, cs, '2026-08-22')).toBe(true)
  })

  it('deleted check-in does not count today', () => {
    const deleted = {
      ...ci('h2', '2026-08-17'),
      deletedAt: '2026-08-17T13:00:00.000Z'
    }
    expect(habitMetOnDay(weekly3, [deleted], '2026-08-17')).toBe(false)
  })

  it('counter without targetValue uses 1 instead of weekly quota', () => {
    const counter: Habit = {
      id: 'h5',
      name: '喝水',
      kind: 'counter',
      frequency: { type: 'weekly', times: 3 },
      createdAt: '2026-08-01T00:00:00.000Z'
    }
    const zero = { ...ci('h5', '2026-08-17'), value: 0 }
    expect(habitMetOnDay(counter, [zero], '2026-08-17')).toBe(false)
    const one = { ...ci('h5', '2026-08-17'), value: 1 }
    expect(habitMetOnDay(counter, [one], '2026-08-17')).toBe(true)
  })
})

describe('habitDoneOnDay（今日卡片完成态）', () => {
  it('自定义休息日无打卡 → 免战、不算完成', () => {
    expect(habitDoneOnDay(weekdays, [], '2026-08-22')).toBe(false)
  })

  it('自定义休息日主动打卡 → 完成且可撤销', () => {
    expect(habitDoneOnDay(weekdays, [ci('h4', '2026-08-22')], '2026-08-22')).toBe(true)
  })

  it('自定义执行日仍按当天打卡判定', () => {
    expect(habitDoneOnDay(weekdays, [], '2026-08-17')).toBe(false)
    expect(habitDoneOnDay(weekdays, [ci('h4', '2026-08-17')], '2026-08-17')).toBe(true)
  })

  it('周频：今日打卡或本周配额满都算完成', () => {
    expect(habitDoneOnDay(weekly3, [ci('h2', '2026-08-17')], '2026-08-17')).toBe(true)
    const quota = [ci('h2', '2026-08-17'), ci('h2', '2026-08-18'), ci('h2', '2026-08-19')]
    expect(habitDoneOnDay(weekly3, quota, '2026-08-22')).toBe(true)
  })
})

describe('isDayComplete', () => {
  it('true when every active habit met', () => {
    const habits = [daily, weekly3]
    const cs = [
      ci('h1', '2026-08-22'),
      ci('h2', '2026-08-20'),
      ci('h2', '2026-08-21'),
      ci('h2', '2026-08-22')
    ]
    expect(isDayComplete(habits, cs, '2026-08-22')).toBe(true)
  })

  it('false when a daily habit missing', () => {
    const cs = [ci('h2', '2026-08-22')]
    expect(isDayComplete([daily, weekly3], cs, '2026-08-22')).toBe(false)
  })

  it('weekly habit met via earlier week quota', () => {
    const cs = [
      ci('h1', '2026-08-22'),
      ci('h2', '2026-08-17'),
      ci('h2', '2026-08-18'),
      ci('h2', '2026-08-19')
    ]
    expect(isDayComplete([daily, weekly3], cs, '2026-08-22')).toBe(true)
  })

  it("weekly habit met by today's check-in alone", () => {
    const cs = [ci('h1', '2026-08-22'), ci('h2', '2026-08-22')]
    expect(isDayComplete([daily, weekly3], cs, '2026-08-22')).toBe(true)
  })

  it('ignores archived habits', () => {
    const archived = { ...weekly3, archivedAt: '2026-08-21T00:00:00.000Z' }
    expect(isDayComplete([daily, archived], [ci('h1', '2026-08-22')], '2026-08-22')).toBe(true)
  })

  it('no habits → false (空状态不算全完成)', () => {
    expect(isDayComplete([], [], '2026-08-22')).toBe(false)
  })
})
