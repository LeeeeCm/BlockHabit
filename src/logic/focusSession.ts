/**
 * B2 / D-20261110-064：桌面专注陪伴的状态机（纯逻辑，无 React / 无 localStorage）。
 *
 * 计时语义（诚实边界）：
 * - 会话只记录「用户自己点开始」的绝对时间 startedAt，应用退出/隐藏不暂停；
 * - 到点只进入 ready，**不自动打卡**；确认落块由 UI 调 checkIn（数据诚实，A6）；
 * - 延长最多 MAX_EXTENSIONS 次，每次 EXTEND_MINUTES 分钟；
 * - 超过 到点 + SESSION_TTL_MS 视为 expired（恢复时静默清理，避免几周后突然弹通知）；
 * - 时钟回拨（now < startedAt）按 elapsed=0 处理，不出现负数倒计时。
 */

/** 每次延长的分钟数 */
export const EXTEND_MINUTES = 5
/** 最多延长次数（防止无限拖延） */
export const MAX_EXTENSIONS = 2
/** 到点后保留会话多久（超过即视为过期，恢复时清理） */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export type FocusPhase = 'focusing' | 'ready' | 'expired'

/** timerStore 持久化的会话结构（保持字段最小化，便于跨版本兼容） */
export interface FocusSessionLike {
  /** 绝对开始时间（epoch ms） */
  startedAt: number
  /** 基础目标时长（未含延长） */
  targetMs: number
  /** 已延长次数（0..MAX_EXTENSIONS） */
  extensions?: number
  /** 已发过「到点」通知的时间戳；持久化以做到重启不重复通知 */
  notifiedAt?: number
}

export interface FocusView {
  phase: FocusPhase
  /** 已过去的时间（时钟回拨时为 0） */
  elapsedMs: number
  /** 剩余时间（focusing 时 > 0；ready/expired 为 0） */
  remainingMs: number
  /** 基础目标时长 */
  baseTargetMs: number
  /** 含延长后的有效目标时长 */
  targetMs: number
  /** 进度 0..1（ready/expired 封顶 1） */
  progress: number
  /** 实际专注分钟（四舍五入、至少 1；与 HabitRow 的既有口径一致） */
  actualMinutes: number
}

/** 规范化延长次数（防御脏存档） */
export function normalizeExtensions(session: FocusSessionLike, maxExtensions = MAX_EXTENSIONS): number {
  const raw = session.extensions
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(maxExtensions, Math.floor(raw)))
}

/** 含延长后的有效目标时长 */
export function effectiveTargetMs(session: FocusSessionLike): number {
  return session.targetMs + normalizeExtensions(session) * EXTEND_MINUTES * 60_000
}

/** 计算当前状态。纯函数：同一 (session, now) 永远得到同一结果。 */
export function viewSession(session: FocusSessionLike, now: number): FocusView {
  const baseTargetMs = Math.max(0, session.targetMs)
  const targetMs = effectiveTargetMs(session)
  const elapsedMs = Math.max(0, now - session.startedAt)
  const remainingMs = Math.max(0, targetMs - elapsedMs)
  const progress = targetMs > 0 ? Math.min(1, elapsedMs / targetMs) : 1
  const phase: FocusPhase =
    elapsedMs >= targetMs + SESSION_TTL_MS ? 'expired' : elapsedMs >= targetMs ? 'ready' : 'focusing'
  return {
    phase,
    elapsedMs,
    remainingMs,
    baseTargetMs,
    targetMs,
    progress,
    // 与 HabitRow 的 actualMinutes 口径保持一致（round + 至少 1 分钟）
    actualMinutes: Math.max(1, Math.round(elapsedMs / 60_000)),
  }
}

/** 到点后放置超过 TTL 的会话视为过期（恢复时静默清理） */
export function isSessionStale(session: FocusSessionLike, now: number, ttlMs = SESSION_TTL_MS): boolean {
  const targetMs = effectiveTargetMs(session)
  return Math.max(0, now - session.startedAt) >= targetMs + ttlMs
}

/**
 * 延长会话。达到上限时原样返回并 extended=false（UI 应隐藏/禁用按钮）。
 * 延长会清空 notifiedAt：新目标到点时应再提醒一次（最多 2 次）。
 */
export function extendSession(
  session: FocusSessionLike,
  minutes = EXTEND_MINUTES,
  maxExtensions = MAX_EXTENSIONS,
): { session: FocusSessionLike; extended: boolean } {
  const extensions = normalizeExtensions(session, maxExtensions)
  if (extensions >= maxExtensions || minutes <= 0) {
    return { session, extended: false }
  }
  return {
    session: { ...session, extensions: extensions + 1, notifiedAt: undefined },
    extended: true,
  }
}

/**
 * 多会话时摆件该显示哪一个：取「最早到点」的一个（同时刻按 startedAt 早者优先）。
 * 过期会话不参与；没有可显示的会话返回 null。
 */
export function primarySessionId(
  sessions: Record<string, FocusSessionLike>,
  now: number,
): string | null {
  let bestId: string | null = null
  let bestEnd = Number.POSITIVE_INFINITY
  let bestStart = Number.POSITIVE_INFINITY
  for (const [id, session] of Object.entries(sessions)) {
    if (isSessionStale(session, now)) continue
    const end = session.startedAt + effectiveTargetMs(session)
    if (end < bestEnd || (end === bestEnd && session.startedAt < bestStart)) {
      bestId = id
      bestEnd = end
      bestStart = session.startedAt
    }
  }
  return bestId
}

/**
 * 倒计时文本：mm:ss；超过 1 小时用 h:mm:ss。
 * 用 ceil 保证「还剩 0.4s」不会显示成 00:00。
 */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) return `${hours}:${mm}:${ss}`
  return `${mm}:${ss}`
}
