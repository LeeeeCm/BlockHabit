/**
 * 晚间收尾提醒的判定（D-20261110-055，纯函数）。
 *
 * 触发条件：全局提醒开着 + 晚间提醒开着 + 到达设定时间 + 今天仍有应做未达标的习惯
 * + 今天还没提醒过。刻意不做连击羞辱文案、不做多次催促。
 */
import { parseHHmm } from './reminderScheduler'

export interface EveningNudgeContext {
  now: Date
  /** 设定时刻 "HH:mm" */
  time: string
  enabled: boolean
  remindersEnabled: boolean
  /** 今天应做且未达标的习惯数 */
  pendingCount: number
  /** 本地时区日期键 */
  day: string
  /** 上次提醒的日期键（localStorage），跨重启去重 */
  lastNudgedDay?: string | null
}

export type EveningNudgeReason =
  | 'disabled'
  | 'global-off'
  | 'invalid-time'
  | 'before-time'
  | 'nothing-pending'
  | 'already-nudged'
  | 'fire'

export interface EveningNudgeDecision {
  fire: boolean
  reason: EveningNudgeReason
  pendingCount: number
}

export function shouldEveningNudge(ctx: EveningNudgeContext): EveningNudgeDecision {
  const base = { pendingCount: ctx.pendingCount }
  if (!ctx.enabled) return { ...base, fire: false, reason: 'disabled' }
  if (!ctx.remindersEnabled) return { ...base, fire: false, reason: 'global-off' }
  const target = parseHHmm(ctx.time)
  if (target === null) return { ...base, fire: false, reason: 'invalid-time' }
  const nowMin = ctx.now.getHours() * 60 + ctx.now.getMinutes()
  if (nowMin < target) return { ...base, fire: false, reason: 'before-time' }
  if (ctx.pendingCount <= 0) return { ...base, fire: false, reason: 'nothing-pending' }
  if (ctx.lastNudgedDay === ctx.day) return { ...base, fire: false, reason: 'already-nudged' }
  return { ...base, fire: true, reason: 'fire' }
}
