/**
 * 晚间收尾提醒的本地偏好（D-20261110-055）。
 * 不进存档 schema、不参与同步：这是「本机的一次性选择」而不是用户数据。
 * localStorage 不可用或内容损坏时一律按「未选择 / 未提醒」容错。
 */

const KEY = 'blockhabit.eveningNudge.v1'

export type NudgeConsent = 'enabled' | 'declined'

interface Prefs {
  consent?: NudgeConsent
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
      consent: p.consent === 'enabled' || p.consent === 'declined' ? p.consent : undefined,
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

export function getNudgeConsent(): NudgeConsent | null {
  return read().consent ?? null
}

export function setNudgeConsent(consent: NudgeConsent): void {
  write({ ...read(), consent })
}

export function getLastNudgedDay(): string | null {
  return read().lastNudgedDay ?? null
}

export function markNudged(day: string): void {
  write({ ...read(), lastNudgedDay: day })
}
