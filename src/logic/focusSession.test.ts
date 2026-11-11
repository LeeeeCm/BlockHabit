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
  planFocusNotifications,
  primarySessionId,
  trayPhaseFor,
  trayStatusFor,
  viewFocusSessions,
  viewSession,
} from './focusSession'
import { getTranslation } from '../i18n'
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

describe('B4 收尾：多会话展示规则、通知计划与托盘相位（纯逻辑）', () => {
  const NOW = 1_000_000 + 30 * MINUTE

  beforeEach(() => {
    localStorage.clear()
    useTimerStore.setState({ sessions: {} })
  })

  it('viewFocusSessions：无会话返回空视图', () => {
    expect(viewFocusSessions({}, NOW)).toEqual({ ordered: [], primaryId: null, otherCount: 0 })
    expect(primarySessionId({}, NOW)).toBeNull()
  })

  it('viewFocusSessions：ready 优先于 focusing，即使 focusing 更早到点', () => {
    const sessions = {
      focusingSoon: { startedAt: NOW - 24 * MINUTE, targetMs: 25 * MINUTE }, // 1 分钟后到点
      readyAlready: { startedAt: NOW - 40 * MINUTE, targetMs: 25 * MINUTE }, // 已到点 15 分钟
    }
    const view = viewFocusSessions(sessions, NOW)
    expect(view.ordered.map((entry) => entry.id)).toEqual(['readyAlready', 'focusingSoon'])
    expect(view.primaryId).toBe('readyAlready')
    expect(view.otherCount).toBe(1)
    expect(view.ordered[0].view.phase).toBe('ready')
    expect(view.ordered[1].view.phase).toBe('focusing')
  })

  it('viewFocusSessions：同相位按最早到点排序（延长后的有效目标参与计算）', () => {
    const sessions = {
      extended: { startedAt: NOW - 20 * MINUTE, targetMs: 20 * MINUTE, extensions: 1 }, // 有效 25 分钟 → 5 分钟后到点
      plain: { startedAt: NOW - 10 * MINUTE, targetMs: 20 * MINUTE }, // 10 分钟后到点
    }
    const view = viewFocusSessions(sessions, NOW)
    expect(view.ordered.map((entry) => entry.id)).toEqual(['extended', 'plain'])
    expect(view.primaryId).toBe('extended')
    expect(view.otherCount).toBe(1)
  })

  it('viewFocusSessions：同到点时刻按 startedAt 早者优先，完全并列时按 id 兜底（确定性）', () => {
    const tieEnd = {
      later: { startedAt: NOW - 5 * MINUTE, targetMs: 25 * MINUTE }, // 同时到点
      earlier: { startedAt: NOW - 10 * MINUTE, targetMs: 30 * MINUTE },
    }
    expect(viewFocusSessions(tieEnd, NOW).primaryId).toBe('earlier')

    const sameEverything = {
      b: { startedAt: NOW - 10 * MINUTE, targetMs: 30 * MINUTE },
      a: { startedAt: NOW - 10 * MINUTE, targetMs: 30 * MINUTE },
    }
    expect(viewFocusSessions(sameEverything, NOW).ordered.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('viewFocusSessions：过期会话不参与展示与计数', () => {
    const sessions = {
      alive: { startedAt: NOW - 5 * MINUTE, targetMs: 25 * MINUTE },
      stale: { startedAt: NOW - (25 * MINUTE + SESSION_TTL_MS + 1), targetMs: 25 * MINUTE },
    }
    const view = viewFocusSessions(sessions, NOW)
    expect(view.ordered.map((entry) => entry.id)).toEqual(['alive'])
    expect(view.primaryId).toBe('alive')
    expect(view.otherCount).toBe(0)
  })

  it('planFocusNotifications：无会话 / 专注中 / 过期都不通知，ready 才通知一次', () => {
    const valid = new Set(['h1'])
    expect(planFocusNotifications({}, NOW, valid)).toEqual([])
    // focusing 不通知
    expect(planFocusNotifications({ h1: { startedAt: NOW - 10 * MINUTE, targetMs: 25 * MINUTE } }, NOW, valid)).toEqual([])
    // 过期不打扰
    expect(
      planFocusNotifications(
        { h1: { startedAt: NOW - (25 * MINUTE + SESSION_TTL_MS + 1), targetMs: 25 * MINUTE } },
        NOW,
        valid,
      ),
    ).toEqual([])
    // ready 且未提醒 → 一条计划，notifiedAt = now（App 必须先落盘再弹）
    expect(
      planFocusNotifications({ h1: { startedAt: NOW - 26 * MINUTE, targetMs: 25 * MINUTE } }, NOW, valid),
    ).toEqual([{ habitId: 'h1', notifiedAt: NOW }])
    // notifiedAt 已落盘 → 不再通知（重启不重复）
    expect(
      planFocusNotifications(
        { h1: { startedAt: NOW - 26 * MINUTE, targetMs: 25 * MINUTE, notifiedAt: NOW - 1000 } },
        NOW,
        valid,
      ),
    ).toEqual([])
    // 习惯已删除/归档（不在有效集合）→ 不通知
    expect(
      planFocusNotifications({ h1: { startedAt: NOW - 26 * MINUTE, targetMs: 25 * MINUTE } }, NOW, new Set(['h2'])),
    ).toEqual([])
  })

  it('planFocusNotifications：多条同时到点按到点时间早者优先，顺序可测', () => {
    const plans = planFocusNotifications(
      {
        later: { startedAt: NOW - 30 * MINUTE, targetMs: 25 * MINUTE }, // 已到点 5 分钟
        earlier: { startedAt: NOW - 40 * MINUTE, targetMs: 25 * MINUTE }, // 已到点 15 分钟
      },
      NOW,
      new Set(['earlier', 'later']),
    )
    expect(plans.map((plan) => plan.habitId)).toEqual(['earlier', 'later'])
    expect(plans.every((plan) => plan.notifiedAt === NOW)).toBe(true)
  })

  it('focusing→ready 只通知一次：notifiedAt 先落盘再通知的契约（store 往返）', () => {
    useTimerStore.setState({ sessions: { h1: { startedAt: NOW - 24 * MINUTE, targetMs: 25 * MINUTE } } })
    expect(planFocusNotifications(useTimerStore.getState().sessions, NOW, new Set(['h1']))).toEqual([])

    const readyNow = NOW + 2 * MINUTE
    const plans = planFocusNotifications(useTimerStore.getState().sessions, readyNow, new Set(['h1']))
    expect(plans).toHaveLength(1)
    // App 的顺序：先 markNotified 落盘，再弹通知
    useTimerStore.getState().markNotified(plans[0].habitId, plans[0].notifiedAt)
    expect(useTimerStore.getState().sessions.h1.notifiedAt).toBe(readyNow)
    expect(readFocusSessions(readyNow).h1.notifiedAt).toBe(readyNow)
    // 下一秒再扫不会重复通知
    expect(planFocusNotifications(useTimerStore.getState().sessions, readyNow + 1000, new Set(['h1']))).toEqual([])
  })

  it('trayPhaseFor：ready 优先于 focusing；无会话 / 过期返回 null', () => {
    expect(trayPhaseFor({}, NOW)).toBeNull()
    expect(trayPhaseFor({ h1: { startedAt: NOW - 5 * MINUTE, targetMs: 25 * MINUTE } }, NOW)).toBe('focusing')
    expect(trayPhaseFor({ h1: { startedAt: NOW - 26 * MINUTE, targetMs: 25 * MINUTE } }, NOW)).toBe('ready')
    expect(
      trayPhaseFor(
        {
          focusing: { startedAt: NOW - 5 * MINUTE, targetMs: 25 * MINUTE },
          ready: { startedAt: NOW - 26 * MINUTE, targetMs: 25 * MINUTE },
        },
        NOW,
      ),
    ).toBe('ready')
    expect(
      trayPhaseFor({ h1: { startedAt: NOW - (25 * MINUTE + SESSION_TTL_MS + 1), targetMs: 25 * MINUTE } }, NOW),
    ).toBeNull()
  })

  it('trayStatusFor：托盘 tooltip 相位字符串准确（zh / en）', () => {
    const base = '今日进度 2/3 · 花园 5/100'
    const zh = getTranslation('zh').focusCompanion
    const en = getTranslation('en').focusCompanion
    expect(trayStatusFor(base, null, zh)).toBe(base)
    expect(trayStatusFor(base, 'focusing', zh)).toBe('今日进度 2/3 · 花园 5/100 · 专注中')
    expect(trayStatusFor(base, 'ready', zh)).toBe('今日进度 2/3 · 花园 5/100 · 时间到，确认后落块')
    expect(trayStatusFor(base, 'focusing', en)).toBe("今日进度 2/3 · 花园 5/100 · Focusing")
    expect(trayStatusFor(base, 'ready', en)).toBe(
      '今日进度 2/3 · 花园 5/100 · Time is up; confirm to place the block',
    )
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
