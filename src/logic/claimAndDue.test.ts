import { describe, expect, it } from 'vitest'
import { canClaimDay, habitMetOnDay, isHabitDueOnDay } from './checkin'
import type { CheckIn, DayClaim, Habit } from '../types'

/**
 * D-20261126-121：两处逻辑修正。
 * 1. 指定星期的习惯只在该星期「该做」；
 * 2. 当天领过全勤后，再完成新习惯也不能再领一次。
 */

const THU = '2026-11-26' // 周四
const MON = '2026-11-30' // 周一

const habit = (id: string, frequency: Habit['frequency'] = { type: 'daily' }): Habit => ({
  id,
  name: id,
  frequency,
  kind: 'instant',
  createdAt: '2026-11-01T00:00:00.000Z'
})
const checkIn = (habitId: string, date: string): CheckIn => ({
  id: `c-${habitId}-${date}`,
  habitId,
  date,
  at: `${date}T09:00:00.000Z`
})
const claim = (date: string): DayClaim => ({
  date,
  claimedAt: `${date}T21:00:00.000Z`,
  blockId: `b-${date}`,
  blueprintId: 'plant'
})

describe('指定星期只在对应星期出现（D-20261126-121）', () => {
  const mondayHabit = habit('mon', { type: 'custom', days: [1] })

  it('周一该做、周四不该做', () => {
    expect(isHabitDueOnDay(mondayHabit, MON)).toBe(true)
    expect(isHabitDueOnDay(mondayHabit, THU)).toBe(false)
  })

  it('不该做的日子不计入「今日完成度」的分母（习惯本身仍判为达标豁免）', () => {
    // 休息日 habitMetOnDay 返回 true（免战），但今日页用的是「该做集合」，不会把它算进分母
    expect(habitMetOnDay(mondayHabit, [], THU)).toBe(true)
    const dueOnThu = [habit('daily')].filter((h) => isHabitDueOnDay(h, THU))
    expect(dueOnThu.map((h) => h.id)).toEqual(['daily'])
  })

  it('多选星期时，任意命中即该做', () => {
    const multi = habit('multi', { type: 'custom', days: [1, 3, 4] })
    expect(isHabitDueOnDay(multi, MON)).toBe(true)
    expect(isHabitDueOnDay(multi, THU)).toBe(true)
    expect(isHabitDueOnDay(multi, '2026-11-27')).toBe(false) // 周五
  })
})

describe('全勤积木每天只能领一次（D-20261126-121）', () => {
  it('已领过 → 即便新习惯全部完成也返回 already', () => {
    const habits = [habit('a'), habit('b')]
    const checkIns = [checkIn('a', THU), checkIn('b', THU)]
    expect(canClaimDay(habits, checkIns, [claim(THU)], THU)).toEqual({
      ok: false,
      reason: 'already'
    })
  })

  it('先判「已领过」：即便还有习惯未完成，也只报 already（不会再诱使去补卡后重领）', () => {
    const habits = [habit('a'), habit('b')]
    expect(canClaimDay(habits, [checkIn('a', THU)], [claim(THU)], THU)).toEqual({
      ok: false,
      reason: 'already'
    })
  })

  it('没领过且全部完成 → 可领', () => {
    const habits = [habit('a')]
    expect(canClaimDay(habits, [checkIn('a', THU)], [], THU)).toEqual({ ok: true })
  })

  it('次日可以再领（每天各一次）', () => {
    const habits = [habit('a')]
    expect(canClaimDay(habits, [checkIn('a', MON)], [claim(THU)], MON)).toEqual({ ok: true })
  })
})
