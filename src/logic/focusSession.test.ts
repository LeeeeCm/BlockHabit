import { beforeEach, describe, expect, it } from 'vitest'
import {
  EXTEND_MINUTES,
  MAX_EXTENSIONS,
  SESSION_TTL_MS,
  effectiveTargetMs,
  extendSession,
  formatRemaining,
  isSessionStale,
  normalizeExtensions,
  primarySessionId,
  viewSession,
} from './focusSession'
import {
  FOCUS_SESSIONS_STORAGE_KEY,
  clearFocusSessions,
  readFocusSessions,
  useTimerStore,
  writeFocusSessions,
  type TimerSession,
} from '../store/timerStore'

const MINUTE = 60_000
const TARGET = 25 * MINUTE

function session(overrides: Partial<TimerSession> = {}): TimerSession {
  return { startedAt: 1_000_000, targetMs: TARGET, ...overrides }
}

describe('focusSession：专注状态机（纯逻辑）', () => {
  it('focusing：中途状态给出剩余时间、进度与实际分钟', () => {
    const view = viewSession(session(), 1_000_000 + 10 * MINUTE)
    expect(view.phase).toBe('focusing')
    expect(view.remainingMs).toBe(15 * MINUTE)
    expect(view.targetMs).toBe(TARGET)
    expect(view.progress).toBeCloseTo(0.4, 5)
    expect(view.actualMinutes).toBe(10)
  })

  it('ready：到达目标即待确认（不自动完成）', () => {
    const view = viewSession(session(), 1_000_000 + TARGET)
    expect(view.phase).toBe('ready')
    expect(view.remainingMs).toBe(0)
    expect(view.progress).toBe(1)
    expect(view.actualMinutes).toBe(25)
  })

  it('ready：超过目标但未超 TTL 仍是 ready', () => {
    const view = viewSession(session(), 1_000_000 + TARGET + 30 * MINUTE)
    expect(view.phase).toBe('ready')
  })

  it('expired：到点后超过 TTL 视为过期（恢复时不再打扰）', () => {
    expect(viewSession(session(), 1_000_000 + TARGET + SESSION_TTL_MS - 1).phase).toBe('ready')
    expect(viewSession(session(), 1_000_000 + TARGET + SESSION_TTL_MS).phase).toBe('expired')
    expect(isSessionStale(session(), 1_000_000 + TARGET + SESSION_TTL_MS)).toBe(true)
    expect(isSessionStale(session(), 1_000_000 + TARGET)).toBe(false)
  })

  it('时钟回拨：now < startedAt 按 elapsed=0 处理，不出现负数倒计时', () => {
    const view = viewSession(session(), 900_000)
    expect(view.phase).toBe('focusing')
    expect(view.elapsedMs).toBe(0)
    expect(view.remainingMs).toBe(TARGET)
    expect(view.progress).toBe(0)
    expect(view.actualMinutes).toBe(1)
  })

  it('跨午夜：23:50 开始、25 分钟目标，00:15 为 ready 且实际 25 分钟', () => {
    const start = new Date(2026, 8, 30, 23, 50, 0).getTime()
    const now = new Date(2026, 9, 1, 0, 15, 0).getTime()
    const view = viewSession({ startedAt: start, targetMs: TARGET }, now)
    expect(view.phase).toBe('ready')
    expect(view.actualMinutes).toBe(25)
  })

  it('actualMinutes 至少 1 分钟（短会话不产生 0）', () => {
    const view = viewSession({ startedAt: 1_000_000, targetMs: 30_000 }, 1_000_000 + 20_000)
    expect(view.actualMinutes).toBe(1)
  })

  it('targetMs 为 0/负数的脏会话不崩溃（防御旧存档）', () => {
    const view = viewSession({ startedAt: 1_000_000, targetMs: 0 }, 1_000_000 + 1)
    expect(view.phase).toBe('ready')
    expect(view.progress).toBe(1)
    const negative = viewSession({ startedAt: 1_000_000, targetMs: -5 }, 1_000_000)
    expect(negative.remainingMs).toBe(0)
  })

  it('normalizeExtensions 钳制脏数据（负数/小数/超大）', () => {
    expect(normalizeExtensions({ startedAt: 1, targetMs: 2 })).toBe(0)
    expect(normalizeExtensions({ startedAt: 1, targetMs: 2, extensions: -3 })).toBe(0)
    expect(normalizeExtensions({ startedAt: 1, targetMs: 2, extensions: 1.7 })).toBe(1)
    expect(normalizeExtensions({ startedAt: 1, targetMs: 2, extensions: 99 })).toBe(MAX_EXTENSIONS)
    expect(normalizeExtensions({ startedAt: 1, targetMs: 2, extensions: Number.NaN })).toBe(0)
  })

  it('effectiveTargetMs：每次延长 +5 分钟', () => {
    expect(effectiveTargetMs({ startedAt: 1, targetMs: TARGET })).toBe(TARGET)
    expect(effectiveTargetMs({ startedAt: 1, targetMs: TARGET, extensions: 1 })).toBe(TARGET + EXTEND_MINUTES * MINUTE)
    expect(effectiveTargetMs({ startedAt: 1, targetMs: TARGET, extensions: 2 })).toBe(
      TARGET + 2 * EXTEND_MINUTES * MINUTE,
    )
  })

  it('延长：清空 notifiedAt 以便新目标到点再提醒一次，达到上限后拒绝', () => {
    const notified = session({ notifiedAt: 1_234 })
    const first = extendSession(notified)
    expect(first.extended).toBe(true)
    expect(first.session.extensions).toBe(1)
    expect(first.session.notifiedAt).toBeUndefined()

    const atCap = extendSession({ ...notified, extensions: MAX_EXTENSIONS })
    expect(atCap.extended).toBe(false)
    expect(atCap.session.extensions).toBe(MAX_EXTENSIONS)

    const zero = extendSession(notified, 0)
    expect(zero.extended).toBe(false)
  })

  it('延长后视图重新回到 focusing（新目标未被追击）', () => {
    const now = 1_000_000 + TARGET + MINUTE
    const extended = extendSession(session()).session
    expect(viewSession(extended, now).phase).toBe('focusing')
    expect(viewSession(extended, now).remainingMs).toBe(4 * MINUTE)
  })

  it('formatRemaining：mm:ss / h:mm:ss，且向上取整避免提前显示 00:00', () => {
    expect(formatRemaining(0)).toBe('00:00')
    expect(formatRemaining(1)).toBe('00:01')
    expect(formatRemaining(999)).toBe('00:01')
    expect(formatRemaining(MINUTE)).toBe('01:00')
    expect(formatRemaining(65_000)).toBe('01:05')
    expect(formatRemaining(3_600_000)).toBe('1:00:00')
    expect(formatRemaining(3_661_000)).toBe('1:01:01')
    expect(formatRemaining(-500)).toBe('00:00')
  })

  it('primarySessionId：取最早到点的一个；并列取更早开始者；过期会话不参与', () => {
    const now = 1_000_000 + 10 * MINUTE
    const sessions = {
      slow: { startedAt: 1_000_000, targetMs: 60 * MINUTE },
      quick: { startedAt: 1_000_000, targetMs: 20 * MINUTE },
    }
    expect(primarySessionId(sessions, now)).toBe('quick')
    expect(primarySessionId({}, now)).toBeNull()

    const tie = {
      later: { startedAt: 1_000_000 + 1000, targetMs: 20 * MINUTE },
      earlier: { startedAt: 1_000_000, targetMs: 20 * MINUTE + 1000 },
    }
    expect(primarySessionId(tie, now)).toBe('earlier')

    const stale = { old: { startedAt: 1_000_000, targetMs: 20 * MINUTE } }
    expect(primarySessionId(stale, 1_000_000 + 20 * MINUTE + SESSION_TTL_MS)).toBeNull()
  })
})

describe('timerStore：专注会话设备本地持久化', () => {
  beforeEach(() => {
    localStorage.clear()
    useTimerStore.setState({ sessions: {} })
  })

  it('start 写入 localStorage（version + sessions），readFocusSessions 可恢复', () => {
    const before = Date.now()
    useTimerStore.getState().start('h1', TARGET)
    const stored = JSON.parse(localStorage.getItem(FOCUS_SESSIONS_STORAGE_KEY) ?? '{}')
    expect(stored.version).toBe(1)
    expect(Object.keys(stored.sessions)).toEqual(['h1'])
    expect(stored.sessions.h1.targetMs).toBe(TARGET)
    expect(stored.sessions.h1.startedAt).toBeGreaterThanOrEqual(before)

    const restored = readFocusSessions()
    expect(restored.h1).toBeDefined()
    expect(restored.h1.targetMs).toBe(TARGET)
    expect(restored.h1.notifiedAt).toBeUndefined()
  })

  it('markNotified 持久化：重启后仍是「已提醒」，不会重复通知', () => {
    useTimerStore.getState().start('h1', TARGET)
    useTimerStore.getState().markNotified('h1', 42)
    expect(useTimerStore.getState().sessions.h1.notifiedAt).toBe(42)
    expect(readFocusSessions().h1.notifiedAt).toBe(42)
    // 重复调用不覆盖已有时间戳
    useTimerStore.getState().markNotified('h1', 99)
    expect(readFocusSessions().h1.notifiedAt).toBe(42)
  })

  it('extend 持久化 extensions，并把 notifiedAt 清空（新目标应再次提醒）', () => {
    useTimerStore.getState().start('h1', TARGET)
    useTimerStore.getState().markNotified('h1', 42)
    expect(useTimerStore.getState().extend('h1')).toBe(true)
    expect(useTimerStore.getState().sessions.h1.extensions).toBe(1)
    expect(useTimerStore.getState().sessions.h1.notifiedAt).toBeUndefined()
    expect(readFocusSessions().h1.extensions).toBe(1)

    expect(useTimerStore.getState().extend('h1')).toBe(true)
    expect(useTimerStore.getState().extend('h1')).toBe(false) // 上限 2 次
    expect(readFocusSessions().h1.extensions).toBe(MAX_EXTENSIONS)
  })

  it('cancel 清除会话并从 localStorage 删除键（保持存储干净）', () => {
    useTimerStore.getState().start('h1', TARGET)
    expect(localStorage.getItem(FOCUS_SESSIONS_STORAGE_KEY)).toBeTruthy()
    useTimerStore.getState().cancel('h1')
    expect(useTimerStore.getState().sessions.h1).toBeUndefined()
    expect(localStorage.getItem(FOCUS_SESSIONS_STORAGE_KEY)).toBeNull()
  })

  it('prune：删除已归档/已删除习惯与过期会话；空集合时保守不清（防 hydrate 前误删）', () => {
    useTimerStore.setState({
      sessions: {
        keep: { startedAt: Date.now() - MINUTE, targetMs: TARGET },
        archived: { startedAt: Date.now() - MINUTE, targetMs: TARGET },
        stale: { startedAt: 1_000_000, targetMs: TARGET },
      },
    })
    useTimerStore.getState().prune(new Set(['keep']), Date.now())
    const ids = Object.keys(useTimerStore.getState().sessions)
    expect(ids).toEqual(['keep'])
    expect(Object.keys(readFocusSessions())).toEqual(['keep'])

    // 空集合 = 习惯还没 hydrate，不能把刚恢复的会话删光
    useTimerStore.getState().prune(new Set())
    expect(useTimerStore.getState().sessions.keep).toBeDefined()
  })

  it('坏 JSON / 非法字段：读取时静默丢弃，不阻塞启动', () => {
    localStorage.setItem(FOCUS_SESSIONS_STORAGE_KEY, '{not json')
    expect(readFocusSessions()).toEqual({})
    localStorage.setItem(
      FOCUS_SESSIONS_STORAGE_KEY,
      JSON.stringify({ version: 1, sessions: { bad: { startedAt: 'x', targetMs: 1 }, ok: { startedAt: 1000, targetMs: 60000 } } }),
    )
    const restored = readFocusSessions(2000)
    expect(Object.keys(restored)).toEqual(['ok'])
  })

  it('writeFocusSessions/clearFocusSessions 可直接用于测试与维护工具', () => {
    writeFocusSessions({ h1: { startedAt: 1000, targetMs: 60_000 } })
    expect(readFocusSessions(2000).h1).toBeDefined()
    clearFocusSessions()
    expect(localStorage.getItem(FOCUS_SESSIONS_STORAGE_KEY)).toBeNull()
  })
})
