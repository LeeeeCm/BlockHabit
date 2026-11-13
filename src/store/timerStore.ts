import { create } from 'zustand'
import {
  MAX_EXTENSIONS,
  extendSession,
  isSessionStale,
  type FocusSessionLike
} from '../logic/focusSession'

/**
 * 专注计时会话（B2 / D-20261110-064）。
 *
 * 与旧实现的区别：会话持久化到 **localStorage（设备本地，不进存档/同步）**。
 * - 为什么不进存档：专注会话是「这台设备上正在发生的事」，多设备同步只会互相打断；
 * - 为什么存绝对时间：应用隐藏/最小化/退出都不暂停计时，重开时按真实时间恢复相位；
 * - notifiedAt 一并持久化：重启后不会把「已提醒过」的到点通知再弹一次。
 *
 * 兼容：sessions[habitId] 仍暴露 startedAt/targetMs，HabitRow 的既有读取不受影响。
 */

export const FOCUS_SESSIONS_STORAGE_KEY = 'blockhabit.focusSessions.v1'
const STORAGE_VERSION = 1

export interface TimerSession extends FocusSessionLike {
  startedAt: number
  targetMs: number
  extensions?: number
  notifiedAt?: number
}

interface TimerStore {
  sessions: Record<string, TimerSession>
  start(habitId: string, targetMs: number): void
  cancel(habitId: string): void
  /** 延长一次（默认 5 分钟，最多 MAX_EXTENSIONS 次）；达到上限返回 false */
  extend(habitId: string, minutes?: number): boolean
  /** 标记「到点通知已发」（持久化去重；重复调用无副作用） */
  markNotified(habitId: string, at?: number): void
  /** 清理已删除/已归档习惯的会话，以及超过 TTL 的过期会话 */
  prune(validHabitIds: ReadonlySet<string>, now?: number): void
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null
  } catch {
    return false
  }
}

function normalizeSession(raw: unknown): TimerSession | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const startedAt = value.startedAt
  const targetMs = value.targetMs
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt) || startedAt <= 0) return null
  if (typeof targetMs !== 'number' || !Number.isFinite(targetMs) || targetMs <= 0) return null
  const session: TimerSession = { startedAt, targetMs }
  if (typeof value.extensions === 'number' && Number.isFinite(value.extensions)) {
    const extensions = Math.max(0, Math.min(MAX_EXTENSIONS, Math.floor(value.extensions)))
    if (extensions > 0) session.extensions = extensions
  }
  if (
    typeof value.notifiedAt === 'number' &&
    Number.isFinite(value.notifiedAt) &&
    value.notifiedAt > 0
  ) {
    session.notifiedAt = value.notifiedAt
  }
  return session
}

/**
 * 从 localStorage 读取会话（坏 JSON / 非法字段 / 过期会话一律丢弃）。
 * 导出供测试与将来「恢复提示」复用；不在读取时打日志，避免启动噪音。
 */
export function readFocusSessions(now: number = Date.now()): Record<string, TimerSession> {
  if (!hasLocalStorage()) return {}
  let parsed: unknown
  try {
    const raw = localStorage.getItem(FOCUS_SESSIONS_STORAGE_KEY)
    if (!raw) return {}
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  const container = parsed as { version?: unknown; sessions?: unknown } | null
  const sessionsRaw =
    container &&
    typeof container === 'object' &&
    container.sessions &&
    typeof container.sessions === 'object'
      ? (container.sessions as Record<string, unknown>)
      : (parsed as Record<string, unknown>)
  const sessions: Record<string, TimerSession> = {}
  for (const [habitId, value] of Object.entries(sessionsRaw)) {
    if (!habitId) continue
    const session = normalizeSession(value)
    if (!session) continue
    // 过期（到点后超过 TTL）静默清理，避免几周后重开突然收到通知
    if (isSessionStale(session, now)) continue
    sessions[habitId] = session
  }
  return sessions
}

/** 写入 localStorage（空会话时删除键，保持存储干净）；失败时静默退化为纯内存 */
export function writeFocusSessions(sessions: Record<string, TimerSession>): void {
  if (!hasLocalStorage()) return
  try {
    if (Object.keys(sessions).length === 0) {
      localStorage.removeItem(FOCUS_SESSIONS_STORAGE_KEY)
      return
    }
    localStorage.setItem(
      FOCUS_SESSIONS_STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, sessions })
    )
  } catch {
    // 隐私模式 / 配额满：不影响计时本身，只是重启后恢复不了
  }
}

export function clearFocusSessions(): void {
  if (!hasLocalStorage()) return
  try {
    localStorage.removeItem(FOCUS_SESSIONS_STORAGE_KEY)
  } catch {
    // 忽略
  }
}

export const useTimerStore = create<TimerStore>()((set, get) => ({
  // 模块加载即恢复（绝对时间，重开直接得到当前相位）
  sessions: readFocusSessions(),

  start(habitId, targetMs) {
    if (!habitId || !Number.isFinite(targetMs) || targetMs <= 0) return
    const sessions = { ...get().sessions, [habitId]: { startedAt: Date.now(), targetMs } }
    writeFocusSessions(sessions)
    set({ sessions })
  },

  cancel(habitId) {
    const current = get().sessions
    if (!current[habitId]) return
    const sessions = { ...current }
    delete sessions[habitId]
    writeFocusSessions(sessions)
    set({ sessions })
  },

  extend(habitId, minutes) {
    const current = get().sessions[habitId]
    if (!current) return false
    const { session, extended } = extendSession(current, minutes)
    if (!extended) return false
    const sessions = { ...get().sessions, [habitId]: session as TimerSession }
    writeFocusSessions(sessions)
    set({ sessions })
    return true
  },

  markNotified(habitId, at = Date.now()) {
    const current = get().sessions[habitId]
    if (!current || current.notifiedAt) return
    const sessions = { ...get().sessions, [habitId]: { ...current, notifiedAt: at } }
    writeFocusSessions(sessions)
    set({ sessions })
  },

  prune(validHabitIds, now = Date.now()) {
    const current = get().sessions
    const ids = Object.keys(current)
    if (ids.length === 0) return
    // 空集合视为「习惯尚未 hydrate」而不是「所有习惯都没了」：宁可不清理，避免误删刚恢复的会话
    if (validHabitIds.size === 0) return
    const sessions: Record<string, TimerSession> = {}
    let changed = false
    for (const [habitId, session] of Object.entries(current)) {
      if (!validHabitIds.has(habitId) || isSessionStale(session, now)) {
        changed = true
        continue
      }
      sessions[habitId] = session
    }
    if (!changed) return
    writeFocusSessions(sessions)
    set({ sessions })
  }
}))
