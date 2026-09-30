import type { CheckIn, Habit } from '../types'
import { addDays, dateKey, parseKey, weekStart } from './dates'
import { isHabitDueOnDay } from './checkin'

function ownCheckIns(habit: Habit, checkIns: CheckIn[]): Set<string> {
  const days = new Set<string>()
  for (const c of checkIns) {
    if (c.deletedAt) continue
    if (c.habitId === habit.id) days.add(c.date)
  }
  return days
}

function weekOfKey(day: string): string {
  return dateKey(weekStart(parseKey(day)))
}

function weekCount(days: Set<string>, weekStartKey: string): number {
  const start = parseKey(weekStartKey)
  let n = 0
  for (let i = 0; i < 7; i++) {
    if (days.has(dateKey(addDays(start, i)))) n++
  }
  return n
}

export function currentStreak(habit: Habit, checkIns: CheckIn[], today: Date): number {
  const days = ownCheckIns(habit, checkIns)
  if (days.size === 0) return 0

  if (habit.frequency.type === 'daily') {
    let streak = 0
    let d = new Date(today)
    if (!days.has(dateKey(d))) d = addDays(d, -1) // 今天没打从昨天起算
    while (days.has(dateKey(d))) {
      streak++
      d = addDays(d, -1)
    }
    return streak
  }
  if (habit.frequency.type === 'custom') {
    if (!habit.frequency.days || habit.frequency.days.length === 0) return 0
    let streak = 0
    let d = new Date(today)
    const todayKeyStr = dateKey(d)
    // 若今天未打卡，从昨日起算
    if (!days.has(todayKeyStr)) {
      d = addDays(d, -1)
    }
    // 无上限回溯：custom 习惯连胜满一年后仍正确累计（days 有限，应执行日未打卡必然中断）
    for (let step = 0; ; step++) {
      const k = dateKey(d)
      const due = isHabitDueOnDay(habit, k)
      if (days.has(k)) {
        streak++
      } else if (due) {
        break // 应执行日未打卡中断
      }
      d = addDays(d, -1)
    }
    return streak
  }

  const times = habit.frequency.times
  let streak = 0
  let week = weekOfKey(dateKey(today))
  const curCount = weekCount(days, week)
  if (curCount < times) week = dateKey(addDays(parseKey(week), -7)) // 本周未达标不计但不中断
  while (weekCount(days, week) >= times) {
    streak++
    week = dateKey(addDays(parseKey(week), -7))
  }
  return streak
}
export interface StreakStatus {
  streak: number
  /** 是否处于温和休整期 (允许今日打卡接续) */
  inRestPeriod: boolean
  missedDays: number
}

/**
 * 带温和抗断卡风化韧性机制的连胜计算 (Gentle Decay):
 * 用户偶发遗漏 1 天时进入温和休整期，不立即残酷清零，保护用户自律成就感
 */
export function currentStreakWithResilience(
  habit: Habit,
  checkIns: CheckIn[],
  today: Date,
  enableGentleDecay: boolean = true,
): StreakStatus {
  if (!enableGentleDecay) {
    return { streak: currentStreak(habit, checkIns, today), inRestPeriod: false, missedDays: 0 }
  }

  const days = ownCheckIns(habit, checkIns)
  if (days.size === 0) {
    return { streak: 0, inRestPeriod: false, missedDays: 0 }
  }

  if (habit.frequency.type === 'daily') {
    const todayStr = dateKey(today)
    const dYesterday = addDays(new Date(today), -1)
    const dDayBefore = addDays(new Date(today), -2)
    const doneToday = days.has(todayStr)
    const missedYesterday = !days.has(dateKey(dYesterday))
    const doneDayBefore = days.has(dateKey(dDayBefore))

    // 场景 A: 今日已打卡，昨日休整，前天有打卡 -> 成功接续连胜 pastStreak + 1
    if (doneToday && missedYesterday && doneDayBefore) {
      const pastStreak = currentStreak(habit, checkIns, dDayBefore)
      if (pastStreak > 0) {
        return { streak: pastStreak + 1, inRestPeriod: false, missedDays: 0 }
      }
    }

    // 场景 B: 今日未打卡，昨日休整，前天有打卡 -> 处于休整期，展示受保护的 pastStreak
    if (!doneToday && missedYesterday && doneDayBefore) {
      const pastStreak = currentStreak(habit, checkIns, dDayBefore)
      if (pastStreak > 0) {
        return { streak: pastStreak, inRestPeriod: true, missedDays: 1 }
      }
    }
  }

  const classic = currentStreak(habit, checkIns, today)
  return { streak: classic, inRestPeriod: false, missedDays: 0 }
}
/** 连续领块天数（每日打卡领块的连击）：今日未领从昨日起算，断日清零 */
export function dayClaimStreak(dayClaims: string[], today: Date): number {
  const days = new Set(dayClaims)
  if (days.size === 0) return 0
  let streak = 0
  let d = new Date(today)
  if (!days.has(dateKey(d))) d = addDays(d, -1)
  while (days.has(dateKey(d))) {
    streak++
    d = addDays(d, -1)
  }
  return streak
}

export function bestStreak(habit: Habit, checkIns: CheckIn[]): number {
  const days = ownCheckIns(habit, checkIns)
  if (days.size === 0) return 0

  if (habit.frequency.type === 'daily') {
    const sorted = [...days].sort()
    let best = 1
    let run = 1
    for (let i = 1; i < sorted.length; i++) {
      const prev = parseKey(sorted[i - 1])
      run = dateKey(addDays(prev, 1)) === sorted[i] ? run + 1 : 1
      if (run > best) best = run
    }
    return best
  }
  if (habit.frequency.type === 'custom') {
    if (!habit.frequency.days || habit.frequency.days.length === 0) return 0
    const sorted = [...days].sort()
    if (sorted.length === 0) return 0
    let best = 1
    let run = 0
    let cur = parseKey(sorted[0])
    const last = parseKey(sorted[sorted.length - 1])
    while (cur <= last) {
      const k = dateKey(cur)
      const due = isHabitDueOnDay(habit, k)
      if (days.has(k)) {
        run++
        if (run > best) best = run
      } else if (due) {
        run = 0
      }
      cur = addDays(cur, 1)
    }
    return Math.max(best, run)
  }

  // 周频：统计每周次数，找最长连续达标周段
  const times = habit.frequency.times
  const counts = new Map<string, number>()
  for (const day of days) {
    const w = weekOfKey(day)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  const weeks = [...counts.keys()].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const w of weeks) {
    const met = (counts.get(w) ?? 0) >= times
    const consecutive = prev !== null && dateKey(addDays(parseKey(w), -7)) === prev
    run = met ? (consecutive ? run + 1 : 1) : 0
    if (run > best) best = run
    prev = w
  }
  return best
}
