/**
 * 习惯到点提醒调度（纯函数，可测）：
 * - 触发窗口：reminder.start → reminder.end（缺省截止 = 当天 23:59）
 * - 首次提醒（start 档）+ 截止临近催促（due-soon 档，剩 ≤30 分钟，一次性）
 * - 贪睡：由 UI/Store 请求（snoozeUntilMs），到期且仍在窗口内再响，次数上限 3
 * - 静默条件：全局开关关 / 当天已达标 / 已跳过今天 / 已归档 / 未设提醒
 *
 * 平台约束（见方案）：桌面端通知只能即时发送，调度必须在应用内做；
 * WebView 隐藏时定时器被节流，由调用方在 visibilitychange/focus 时补扫兜底。
 */
import type { Habit } from '../types'

/** 贪睡间隔（分钟） */
export const SNOOZE_MINUTES = 10
/** 贪睡次数上限（会话内按天计） */
export const MAX_SNOOZES = 3
/** 截止临近催促窗口（分钟） */
export const DUE_SOON_WINDOW_MINUTES = 30
/** 无截止时间时窗口封顶（当天 23:59） */
const DAY_END_MINUTES = 24 * 60

export type ReminderStage = 'start' | 'due-soon'

export interface ReminderTrack {
  date: string
  /** 首次提醒已发 */
  startNotified: boolean
  /** 截止临近催促已发 */
  dueSoonNotified: boolean
  /** 贪睡到期时刻（epoch ms）；未设置 = 不在贪睡等待 */
  snoozeUntilMs?: number
  /** 已请求贪睡的次数（请求时即 +1，上限 3） */
  snoozeCount: number
}

export function freshTrack(date: string): ReminderTrack {
  return { date, startNotified: false, dueSoonNotified: false, snoozeCount: 0 }
}

/** "HH:mm" → 当日分钟数；非法返回 null */
export function parseHHmm(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isInteger(h) || !Number.isInteger(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null
  }
  return h * 60 + min
}

export interface ReminderScanContext {
  now: Date
  /** 本地时区日期键（todayKey），与 useTodayKey 翻日口径一致 */
  day: string
  habit: Habit
  remindersEnabled: boolean
  /** 当天是否已达标（habitMetOnDay 口径：已打卡/周配额满/休息日豁免/计数达标） */
  metToday: boolean
  /** 今天是否已「跳过今天」（reminderLog 持久化） */
  skippedToday: boolean
  track?: ReminderTrack
}

export interface ReminderScanResult {
  track: ReminderTrack
  notify?: { stage: ReminderStage }
}

/** 单个习惯的提醒扫描：纯函数，输入会话轨迹 + 当天事实，输出新轨迹与是否触发 */
export function scanHabitReminder(ctx: ReminderScanContext): ReminderScanResult {
  const track = ctx.track && ctx.track.date === ctx.day ? ctx.track : freshTrack(ctx.day)

  if (!ctx.remindersEnabled || !ctx.habit.reminder || ctx.habit.archivedAt) return { track }
  if (ctx.metToday || ctx.skippedToday) {
    return { track: { ...track, snoozeUntilMs: undefined } }
  }

  const reminder = ctx.habit.reminder
  const startMin = parseHHmm(reminder.start)
  if (startMin === null) return { track }
  // 防御：截止非法或 ≤ 开始时按无截止处理（表单已校验，运行时兜底）
  const endRaw = reminder.end !== undefined ? parseHHmm(reminder.end) : null
  const endMin = endRaw !== null && endRaw > startMin ? endRaw : null
  const windowEnd = endMin ?? DAY_END_MINUTES

  const nowMin = ctx.now.getHours() * 60 + ctx.now.getMinutes()
  const nowMs = ctx.now.getTime()
  const inWindow = nowMin >= startMin && nowMin < windowEnd
  const dueSoon = endMin !== null && nowMin >= endMin - DUE_SOON_WINDOW_MINUTES && nowMin < endMin

  // 贪睡等待期内静默；到期且仍在窗口内再响（次数上限由贪睡请求侧约束）
  if (track.snoozeUntilMs !== undefined) {
    if (nowMs < track.snoozeUntilMs) return { track }
    if (inWindow) {
      return {
        track: { ...track, snoozeUntilMs: undefined },
        notify: { stage: dueSoon ? 'due-soon' : 'start' },
      }
    }
    return { track: { ...track, snoozeUntilMs: undefined } }
  }

  // 首次提醒（含错过开始时间后的回窗补发）
  if (!track.startNotified && inWindow) {
    return {
      track: { ...track, startNotified: true },
      notify: { stage: dueSoon ? 'due-soon' : 'start' },
    }
  }

  // 截止临近催促：仅一次，且不与首次提醒同拍重复
  if (dueSoon && track.startNotified && !track.dueSoonNotified) {
    return {
      track: { ...track, dueSoonNotified: true },
      notify: { stage: 'due-soon' },
    }
  }

  return { track }
}

/** 按当前 period 给出建议默认提醒时刻（"HH:mm"）；表单智能预填用 */
export function suggestedReminderStart(period: Habit['period'], now: Date): string {
  const h = now.getHours()
  const rounded = `${String(h).padStart(2, '0')}:${now.getMinutes() < 30 ? '00' : '30'}`
  switch (period) {
    case 'morning':
      return '08:00'
    case 'afternoon':
      return '12:30'
    case 'evening':
      return '21:00'
    default:
      return rounded
  }
}

/** 分钟数 → "HH:mm" */
export function minutesToHHmm(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
