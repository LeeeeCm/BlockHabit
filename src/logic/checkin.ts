import type { CheckIn, Habit } from '../types'
import { parseKey, todayKey, weekStart, dateKey } from './dates'

export type CanCheckInResult =
  | { ok: true }
  | { ok: false; reason: 'no-habit' | 'archived' | 'already' | 'weekly-full' }

export function dayCheckInsFor(checkIns: CheckIn[], habitId: string, day: string): CheckIn[] {
  return checkIns.filter((c) => c.habitId === habitId && c.date === day)
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

function habitMetOnDay(habit: Habit, checkIns: CheckIn[], day: string): boolean {
  if (habit.frequency.type === 'daily') {
    return dayCheckInsFor(checkIns, habit.id, day).length > 0
  }
  return weekCountFor(checkIns, habit.id, day) >= habit.frequency.times
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
  if (dayCheckInsFor(checkIns, habitId, day).length > 0) return { ok: false, reason: 'already' }
  if (habit.frequency.type === 'weekly') {
    if (weekCountFor(checkIns, habitId, day) >= habit.frequency.times) {
      return { ok: false, reason: 'weekly-full' }
    }
  }
  return { ok: true }
}

/** 当日所有未归档习惯都达标（空习惯列表不算） */
export function isDayComplete(habits: Habit[], checkIns: CheckIn[], day: string): boolean {
  const active = habits.filter((h) => !h.archivedAt)
  if (active.length === 0) return false
  return active.every((h) => habitMetOnDay(h, checkIns, day))
}

/** 某日各习惯完成比例 0~1（热图灰阶用），无习惯返回 -1 */
export function dayCompletionRatio(habits: Habit[], checkIns: CheckIn[], day: string): number {
  const active = habits.filter((h) => !h.archivedAt)
  if (active.length === 0) return -1
  const met = active.filter((h) => habitMetOnDay(h, checkIns, day)).length
  return met / active.length
}

export { todayKey, dateKey }
