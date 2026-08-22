import { describe, it, expect } from 'vitest'
import { canCheckIn, weekCountFor, isDayComplete } from './checkin'
import type { Habit, CheckIn } from '../types'

const daily: Habit = {
  id: 'h1',
  name: '读书',
  frequency: { type: 'daily' },
  createdAt: '2026-08-01T00:00:00.000Z',
}
const weekly3: Habit = {
  id: 'h2',
  name: '健身',
  frequency: { type: 'weekly', times: 3 },
  createdAt: '2026-08-01T00:00:00.000Z',
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
    expect(canCheckIn([archived], [], 'h1', '2026-08-22')).toEqual({ ok: false, reason: 'archived' })
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
    expect(canCheckIn([weekly3], full, 'h2', '2026-08-20')).toEqual({ ok: false, reason: 'weekly-full' })
  })

  it('weekly: previous week does not count toward this week', () => {
    const prev = [ci('h2', '2026-08-10'), ci('h2', '2026-08-11'), ci('h2', '2026-08-12')]
    expect(canCheckIn([weekly3], prev, 'h2', '2026-08-19').ok).toBe(true)
  })
})

describe('weekCountFor', () => {
  it('counts only this week', () => {
    const cs = [ci('h2', '2026-08-16'), ci('h2', '2026-08-17'), ci('h2', '2026-08-18'), ci('h2', '2026-08-22')]
    // 8-16 属于上周（周日），8-22 属于本周（周六）
    expect(weekCountFor(cs, 'h2', '2026-08-22')).toBe(3)
  })
})

describe('isDayComplete', () => {
  it('true when every active habit met', () => {
    const habits = [daily, weekly3]
    const cs = [ci('h1', '2026-08-22'), ci('h2', '2026-08-20'), ci('h2', '2026-08-21'), ci('h2', '2026-08-22')]
    expect(isDayComplete(habits, cs, '2026-08-22')).toBe(true)
  })

  it('false when a daily habit missing', () => {
    const cs = [ci('h2', '2026-08-22')]
    expect(isDayComplete([daily, weekly3], cs, '2026-08-22')).toBe(false)
  })

  it('weekly habit met via earlier week quota', () => {
    const cs = [ci('h1', '2026-08-22'), ci('h2', '2026-08-17'), ci('h2', '2026-08-18'), ci('h2', '2026-08-19')]
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
