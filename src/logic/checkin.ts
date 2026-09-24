import type { CheckIn, Habit } from '../types'
import { addDays, parseKey, todayKey, weekStart, dateKey } from './dates'

export type CanCheckInResult =
  | { ok: true }
  | { ok: false; reason: 'no-habit' | 'archived' | 'already' | 'weekly-full' }

export function dayCheckInsFor(checkIns: CheckIn[], habitId: string, day: string): CheckIn[] {
  return checkIns.filter((c) => c.habitId === habitId && c.date === day)
}
/** 该习惯在指定日期的累计步进数值（针对 counter 习惯） */
export function dayCounterValue(checkIns: CheckIn[], habitId: string, day: string): number {
  return dayCheckInsFor(checkIns, habitId, day).reduce((sum, c) => sum + (c.value ?? 0), 0)
}

/** 该习惯在 day 所在自然周（周一起）内的打卡数 */
export function weekCountFor(checkIns: CheckIn[], habitId: string, day: string): number {
  const start = weekStart(parseKey(day))
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return checkIns.filter((c) => {
    if (c.habitId !== habitId) return false
    const d = parseKey(c.date)
    return d >= start && d < end
  }).length
}

/** 判断某习惯在指定日期是否为设定的执行日 */
export function isHabitDueOnDay(habit: Habit, day: string): boolean {
  if (habit.frequency.type === 'daily') return true
  if (habit.frequency.type === 'weekly') return true
  if (habit.frequency.type === 'custom') {
    const d = parseKey(day)
    const isoDay = d.getDay() === 0 ? 7 : d.getDay()
    return habit.frequency.days.includes(isoDay)
  }
  return true
}

/** 某习惯在指定日期是否达标（日频=当天有打卡；周频=本周配额已满；自定义频次=休息日免战/执行日有打卡；量化型=累计数值达到目标） */
export function habitMetOnDay(habit: Habit, checkIns: CheckIn[], day: string): boolean {
  if (habit.frequency.type === 'custom' && !isHabitDueOnDay(habit, day)) {
    return true // 休息日豁免达标
  }
  if (habit.kind === 'counter' && habit.targetValue) {
    return dayCounterValue(checkIns, habit.id, day) >= habit.targetValue
  }
  if (habit.frequency.type === 'daily' || habit.frequency.type === 'custom') {
    return dayCheckInsFor(checkIns, habit.id, day).length > 0
  }
  if (habit.frequency.type === 'weekly') {
    return weekCountFor(checkIns, habit.id, day) >= habit.frequency.times
  }
  return false
}
export function canCheckIn(
  habits: Habit[],
  checkIns: CheckIn[],
  habitId: string,
  day: string,
): CanCheckInResult {
  const habit = habits.find((h) => h.id === habitId)
  if (!habit) return { ok: false, reason: 'no-habit' }
  if (habit.archivedAt) return { ok: false, reason: 'archived' }
  if (habit.kind !== 'counter' && dayCheckInsFor(checkIns, habitId, day).length > 0) {
    return { ok: false, reason: 'already' }
  }
  if (habit.frequency.type === 'weekly') {
    if (weekCountFor(checkIns, habitId, day) >= habit.frequency.times) {
      return { ok: false, reason: 'weekly-full' }
    }
  }
  return { ok: true }
}

export function canUndoCheckIn(checkIns: CheckIn[], habitId: string, day: string): boolean {
  return dayCheckInsFor(checkIns, habitId, day).length > 0
}

/** 当日所有未归档习惯都达标（空习惯列表不算） */
export function isDayComplete(habits: Habit[], checkIns: CheckIn[], day: string): boolean {
  const active = habits.filter((h) => !h.archivedAt)
  if (active.length === 0) return false
  return active.every((h) => habitMetOnDay(h, checkIns, day))
}

export type CanClaimDayResult =
  | { ok: true }
  | { ok: false; reason: 'no-habits' | 'incomplete' | 'already' }

/** 每日打卡领块：全部任务完成且今日未领过才能领 */
export function canClaimDay(
  habits: Habit[],
  checkIns: CheckIn[],
  dayClaims: string[],
  day: string,
): CanClaimDayResult {
  const active = habits.filter((h) => !h.archivedAt)
  if (active.length === 0) return { ok: false, reason: 'no-habits' }
  if (dayClaims.includes(day)) return { ok: false, reason: 'already' }
  if (!active.every((h) => habitMetOnDay(h, checkIns, day))) return { ok: false, reason: 'incomplete' }
  return { ok: true }
}

/** 某习惯在指定日期是否应计入统计：当天已创建，且当天尚未归档 */
export function habitActiveOnDay(h: Habit, day: string): boolean {
  const d = parseKey(day)
  const next = addDays(d, 1)
  if (new Date(h.createdAt) >= next) return false
  if (h.archivedAt && new Date(h.archivedAt) < d) return false
  return true
}

/** 某日各习惯完成比例 0~1（热图用）；当天没有任何在册习惯返回 -1（无数据） */
export function dayCompletionRatio(habits: Habit[], checkIns: CheckIn[], day: string): number {
  const onThatDay = habits.filter((h) => habitActiveOnDay(h, day))
  if (onThatDay.length === 0) return -1
  const met = onThatDay.filter((h) => habitMetOnDay(h, checkIns, day)).length
  return met / onThatDay.length
}

export { todayKey, dateKey }
