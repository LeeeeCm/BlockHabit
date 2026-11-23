/**
 * 晚间收尾提醒的本地偏好（D-20261110-055）。
 * 不进存档 schema、不参与同步：这是「本机的一次性选择」而不是用户数据。
 * localStorage 不可用或内容损坏时一律按「未提醒」容错。
 *
 * 2026-11-24（D-20261124-081）：移除今日页的一次性授权卡，只保留「今天是否已提醒」；
 * 功能开关统一在设置页（settings.eveningNudgeEnabled）。
 */

const KEY = 'blockhabit.eveningNudge.v1'

interface Prefs {
  lastNudgedDay?: string
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const p = parsed as Record<string, unknown>
    return {
      lastNudgedDay: typeof p.lastNudgedDay === 'string' ? p.lastNudgedDay : undefined
    }
  } catch {
    return {}
  }
}

function write(next: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 隐私模式/禁用 localStorage：静默降级为「本次会话内不提醒」
  }
}

export function getLastNudgedDay(): string | null {
  return read().lastNudgedDay ?? null
}

export function markNudged(day: string): void {
  write({ ...read(), lastNudgedDay: day })
}
