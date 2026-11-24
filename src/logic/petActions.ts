import type { CheckIn, Habit, ReminderLogEntry } from '../types'
import type { PendingReminder } from '../store/reminderStore'
import { canCheckInHabit, habitMetOnDay, isHabitDueOnDay } from './checkin'
import { dateKey } from './dates'
import { effectiveTargetMs, viewSession, type FocusSessionLike } from './focusSession'
import { parseHHmm } from './reminderScheduler'

export interface PetPendingHabit {
  habit: Habit
  canRecord: boolean
}

function isPending(habit: Habit, checkIns: CheckIn[], day: string): boolean {
  return !habit.archivedAt && isHabitDueOnDay(habit, day) && !habitMetOnDay(habit, checkIns, day)
}

export function petPendingHabits(
  habits: Habit[],
  checkIns: CheckIn[],
  day: string
): PetPendingHabit[] {
  return habits
    .filter((habit) => isPending(habit, checkIns, day))
    .map((habit) => ({
      habit,
      canRecord: canCheckInHabit(habit, checkIns, day).ok
    }))
}

type PetCheckInIntent =
  | { type: 'stale' }
  | { type: 'start'; targetMs: number }
  | { type: 'show-focus' }
  | { type: 'record'; minutes?: number; delta?: number }

export function petCounterStep(habit: Habit): number {
  const step = habit.step ?? 1
  return Number.isFinite(step) && step > 0 ? step : 1
}

/** 这里只作决定；真正写入仍走 appStore.checkIn。客户端必须传入点击当下的事实。 */
export function petCheckInIntent(
  habit: Habit | undefined,
  checkIns: CheckIn[],
  shownDay: string,
  currentDay: string,
  now: number,
  session?: FocusSessionLike,
  confirmation?: FocusSessionLike
): PetCheckInIntent {
  if (
    shownDay !== currentDay ||
    !habit ||
    !isPending(habit, checkIns, currentDay) ||
    !canCheckInHabit(habit, checkIns, currentDay).ok
  )
    return { type: 'stale' }

  if (confirmation) {
    if (
      habit.kind !== 'focus' ||
      !session ||
      session.startedAt !== confirmation.startedAt ||
      effectiveTargetMs(session) !== effectiveTargetMs(confirmation)
    )
      return { type: 'stale' }
    const view = viewSession(session, now)
    return view.phase === 'ready'
      ? { type: 'record', minutes: view.actualMinutes }
      : { type: 'stale' }
  }
  if (habit.kind === 'counter') return { type: 'record', delta: petCounterStep(habit) }
  if (habit.kind !== 'focus') return { type: 'record' }
  if (session && viewSession(session, now).phase !== 'expired') return { type: 'show-focus' }
  const targetMinutes = habit.targetMinutes ?? 0
  return Number.isFinite(targetMinutes) && targetMinutes > 0
    ? { type: 'start', targetMs: targetMinutes * 60_000 }
    : { type: 'stale' }
}

/** 旧队列不代表还能打卡：跨日、提醒窗口结束、同步跳过或重设时均失效。 */
export function reminderIsCurrent(
  item: PendingReminder,
  habit: Habit | undefined,
  checkIns: CheckIn[],
  now: Date,
  enabled: boolean,
  disposition?: ReminderLogEntry
): boolean {
  const day = dateKey(now)
  if (
    !enabled ||
    !habit?.reminder ||
    !isPending(habit, checkIns, day) ||
    disposition?.date === day ||
    item.firedAt > now.getTime() ||
    dateKey(new Date(item.firedAt)) !== day ||
    item.start !== habit.reminder.start ||
    item.end !== habit.reminder.end
  )
    return false
  const start = parseHHmm(item.start)
  const end = item.end === undefined ? null : parseHHmm(item.end)
  const minute = now.getHours() * 60 + now.getMinutes()
  return start !== null && minute >= start && (end === null || end <= start || minute < end)
}
