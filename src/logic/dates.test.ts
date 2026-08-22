import { describe, it, expect } from 'vitest'
import { todayKey, dateKey, weekStart, addDays } from './dates'

describe('dates', () => {
  it('todayKey formats local date as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 7, 22, 23, 30))).toBe('2026-08-22')
  })

  it('dateKey pads month and day', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('weekStart returns Monday 00:00 of same week', () => {
    // 2026-08-22 是周六
    const monday = weekStart(new Date(2026, 7, 22))
    expect(monday.getDay()).toBe(1)
    expect(dateKey(monday)).toBe('2026-08-17')
    expect(monday.getHours()).toBe(0)
  })

  it('weekStart of Monday is itself', () => {
    const d = new Date(2026, 7, 17)
    expect(dateKey(weekStart(d))).toBe('2026-08-17')
  })

  it('weekStart crosses month boundary', () => {
    // 2026-08-01 周六 → 周一 7-27
    expect(dateKey(weekStart(new Date(2026, 7, 1)))).toBe('2026-07-27')
  })

  it('addDays crosses month', () => {
    expect(dateKey(addDays(new Date(2026, 7, 31), 1))).toBe('2026-09-01')
    expect(dateKey(addDays(new Date(2026, 7, 1), -1))).toBe('2026-07-31')
  })
})
