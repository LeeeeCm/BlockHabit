import type { Habit } from '../../types'

/** 周频习惯本周是否已无法达标（剩余天数 < 还需次数） */
export function weekMissed(habit: Habit, weekCount: number, day: string): boolean {
  if (habit.frequency.type !== 'weekly') return false
  const need = habit.frequency.times - weekCount
  if (need <= 0) return false
  const d = new Date(day + 'T00:00:00')
  const daysLeft = 7 - ((d.getDay() + 6) % 7)
  return need > daysLeft
}

/** 周频习惯本周配额已满且今日没有打卡：完成态仅来自周配额，不可撤销 */
export function isQuotaOnlyDone(
  habit: Habit,
  weekCount: number,
  todayCheckInCount: number
): boolean {
  if (habit.frequency.type !== 'weekly') return false
  if (habit.kind === 'counter') return false
  return weekCount >= habit.frequency.times && todayCheckInCount === 0
}

/** 专注剩余时间格式化为 mm:ss（至少 0） */
export function fmtRemaining(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
