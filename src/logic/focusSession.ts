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
export function normalizeExtensions(
  session: FocusSessionLike,
  maxExtensions = MAX_EXTENSIONS
): number {
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
    elapsedMs >= targetMs + SESSION_TTL_MS
      ? 'expired'
      : elapsedMs >= targetMs
        ? 'ready'
        : 'focusing'
  return {
    phase,
    elapsedMs,
    remainingMs,
    baseTargetMs,
    targetMs,
    progress,
    // 与 HabitRow 的 actualMinutes 口径保持一致（round + 至少 1 分钟）
    actualMinutes: Math.max(1, Math.round(elapsedMs / 60_000))
  }
}

/** 到点后放置超过 TTL 的会话视为过期（恢复时静默清理） */
export function isSessionStale(
  session: FocusSessionLike,
  now: number,
  ttlMs = SESSION_TTL_MS
): boolean {
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
  maxExtensions = MAX_EXTENSIONS
): { session: FocusSessionLike; extended: boolean } {
  const extensions = normalizeExtensions(session, maxExtensions)
  if (extensions >= maxExtensions || minutes <= 0) {
    return { session, extended: false }
  }
  return {
    session: { ...session, extensions: extensions + 1, notifiedAt: undefined },
    extended: true
  }
}

/** 一个会话在 UI 里的展示条目 */
export interface FocusSessionEntry {
  id: string
  view: FocusView
}

/**
 * 多会话展示视图（B4 / D-20261110-064 收尾）：
 * - ready 优先于 focusing：待确认的会话必须最先被看见，否则用户会一直等一个「已经到点」的会话；
 * - 同相位按到点时间（startedAt + 有效目标）早者优先，再按 startedAt、id 兜底保证确定性；
 * - 过期会话（到点超过 TTL）不参与展示，由调用方 prune 清理。
 */
export interface FocusSessionsView {
  /** 按展示优先级排序的会话（primaryId 恒为 ordered[0]?.id） */
  ordered: FocusSessionEntry[]
  /** 主面板应显示的会话；没有可展示会话时为 null */
  primaryId: string | null
  /** 主会话之外仍在进行/待确认的会话数（「另有 N 个专注」） */
  otherCount: number
}

/** 展示优先级：ready=0 先于 focusing=1 */
function phaseRank(phase: FocusPhase): number {
  return phase === 'ready' ? 0 : 1
}

/** 计算多会话展示视图（纯函数；同一 (sessions, now) 永远得到同一结果） */
export function viewFocusSessions(
  sessions: Record<string, FocusSessionLike>,
  now: number
): FocusSessionsView {
  const entries: Array<{
    id: string
    view: FocusView
    rank: number
    end: number
    startedAt: number
  }> = []
  for (const [id, session] of Object.entries(sessions)) {
    const view = viewSession(session, now)
    if (view.phase === 'expired') continue
    entries.push({
      id,
      view,
      rank: phaseRank(view.phase),
      end: session.startedAt + view.targetMs,
      startedAt: session.startedAt
    })
  }
  entries.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.end - b.end ||
      a.startedAt - b.startedAt ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const ordered = entries.map(({ id, view }) => ({ id, view }))
  return {
    ordered,
    primaryId: ordered[0]?.id ?? null,
    otherCount: Math.max(0, ordered.length - 1)
  }
}

/**
 * 多会话时摆件该显示哪一个：viewFocusSessions 的主会话（ready 优先，其次最早到点）。
 * 过期会话不参与；没有可显示的会话返回 null。保留此函数作为既有调用方的稳定入口。
 */
export function primarySessionId(
  sessions: Record<string, FocusSessionLike>,
  now: number
): string | null {
  return viewFocusSessions(sessions, now).primaryId
}

/** 一条「到点通知」计划：App 必须先 markNotified(notifiedAt) 落盘，再弹通知（重启不重复） */
export interface FocusNotificationPlan {
  habitId: string
  /** 应写入会话的 notifiedAt（= now） */
  notifiedAt: number
}

/**
 * 通知计划（B4）：把 App.tsx 里 TimerWatcher 的判定抽成纯函数，App 只做副作用调用。
 * 规则：
 * - 只有 ready 相位才通知（focusing/expired 不通知；过期不打扰）；
 * - notifiedAt 已存在则跳过（重启恢复后不重复通知）；
 * - 习惯已删除/归档（不在 validHabitIds）不通知；
 * - 同一时刻多条到点时按到点时间早者优先，再按 habitId 兜底，保证顺序可测。
 */
export function planFocusNotifications(
  sessions: Record<string, FocusSessionLike>,
  now: number,
  validHabitIds: ReadonlySet<string>
): FocusNotificationPlan[] {
  const plans: Array<{ habitId: string; notifiedAt: number; end: number }> = []
  for (const [habitId, session] of Object.entries(sessions)) {
    if (!validHabitIds.has(habitId)) continue
    if (session.notifiedAt) continue
    const view = viewSession(session, now)
    if (view.phase !== 'ready') continue
    plans.push({ habitId, notifiedAt: now, end: session.startedAt + view.targetMs })
  }
  plans.sort(
    (a, b) => a.end - b.end || (a.habitId < b.habitId ? -1 : a.habitId > b.habitId ? 1 : 0)
  )
  return plans.map(({ habitId, notifiedAt }) => ({ habitId, notifiedAt }))
}

/** 托盘/摆件的专注相位：ready 优先于 focusing；没有会话返回 null */
export type TrayFocusPhase = 'focusing' | 'ready' | null

export function trayPhaseFor(
  sessions: Record<string, FocusSessionLike>,
  now: number
): TrayFocusPhase {
  const first = viewFocusSessions(sessions, now).ordered[0]
  if (!first) return null
  return first.view.phase === 'ready' ? 'ready' : 'focusing'
}

export interface FocusPhaseLabels {
  focusing: string
  ready: string
}

/**
 * 托盘 tooltip 文案（B4）：基础进度文案 + 专注相位后缀。
 * 无会话时原样返回；相位变化才改变字符串，调用方据此只在相位变化时 update_tray。
 */
export function trayStatusFor(
  base: string,
  phase: TrayFocusPhase,
  labels: FocusPhaseLabels
): string {
  if (phase === 'focusing') return `${base} · ${labels.focusing}`
  if (phase === 'ready') return `${base} · ${labels.ready}`
  return base
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
