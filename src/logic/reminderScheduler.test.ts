import { describe, it, expect, beforeEach } from 'vitest'
import {
  scanHabitReminder,
  parseHHmm,
  suggestedReminderStart,
  minutesToHHmm,
  freshTrack,
  MAX_SNOOZES,
  SNOOZE_MINUTES,
  type ReminderTrack
} from './reminderScheduler'
import { useReminderStore } from '../store/reminderStore'
import type { Habit } from '../types'

const DAY = '2026-10-02'

function habitWith(reminder: { start: string; end?: string } | undefined): Habit {
  return {
    id: 'h1',
    name: '背单词',
    frequency: { type: 'daily' },
    createdAt: '2026-08-01T00:00:00.000Z',
    reminder
  }
}

/** 2026-10-02 当天 HH:mm 的 Date（本地时区） */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2026, 9, 2, h, m)
}

interface ScanOpts {
  now: Date
  reminder?: { start: string; end?: string }
  metToday?: boolean
  skippedToday?: boolean
  enabled?: boolean
  track?: ReminderTrack
}

function scan({
  now,
  reminder,
  metToday = false,
  skippedToday = false,
  enabled = true,
  track
}: ScanOpts) {
  return scanHabitReminder({
    now,
    day: DAY,
    habit: habitWith(reminder),
    remindersEnabled: enabled,
    metToday,
    skippedToday,
    track
  })
}

describe('parseHHmm', () => {
  it('parses valid times to minutes', () => {
    expect(parseHHmm('00:00')).toBe(0)
    expect(parseHHmm('21:30')).toBe(21 * 60 + 30)
    expect(parseHHmm('9:05')).toBe(9 * 60 + 5)
  })
  it('rejects invalid times', () => {
    expect(parseHHmm('24:00')).toBeNull()
    expect(parseHHmm('12:60')).toBeNull()
    expect(parseHHmm('12')).toBeNull()
    expect(parseHHmm('')).toBeNull()
    expect(parseHHmm('ab:cd')).toBeNull()
  })
})

describe('scanHabitReminder — 首次提醒', () => {
  it('开始时间前不提醒', () => {
    const r = scan({ now: at('20:59'), reminder: { start: '21:00', end: '23:00' } })
    expect(r.notify).toBeUndefined()
    expect(r.track.startNotified).toBe(false)
  })

  it('到点即提醒（start 档），同一天不重复', () => {
    const first = scan({ now: at('21:00'), reminder: { start: '21:00', end: '23:00' } })
    expect(first.notify).toEqual({ stage: 'start' })
    expect(first.track.startNotified).toBe(true)

    const again = scan({
      now: at('21:30'),
      reminder: { start: '21:00', end: '23:00' },
      track: first.track
    })
    expect(again.notify).toBeUndefined()
  })

  it('错过开始时间后回窗补发（catch-up）', () => {
    const r = scan({ now: at('22:10'), reminder: { start: '21:00', end: '23:00' } })
    expect(r.notify).toEqual({ stage: 'start' })
  })

  it('无截止时间时窗口到当天末尾，临近午夜仍可补发', () => {
    const r = scan({ now: at('23:50'), reminder: { start: '21:00' } })
    expect(r.notify).toEqual({ stage: 'start' })
  })

  it('截止非法（≤ 开始）时按无截止处理', () => {
    const r = scan({ now: at('23:50'), reminder: { start: '21:00', end: '20:00' } })
    expect(r.notify).toEqual({ stage: 'start' })
  })
})

describe('scanHabitReminder — 静默条件', () => {
  const reminder = { start: '21:00' }

  it('当天已达标不提醒', () => {
    const r = scan({ now: at('21:30'), reminder, metToday: true })
    expect(r.notify).toBeUndefined()
  })

  it('今天已跳过不提醒，且清掉未到期的贪睡', () => {
    const track: ReminderTrack = { ...freshTrack(DAY), snoozeUntilMs: at('21:31').getTime() }
    const r = scan({ now: at('21:30'), reminder, skippedToday: true, track })
    expect(r.notify).toBeUndefined()
    expect(r.track.snoozeUntilMs).toBeUndefined()
  })

  it('全局开关关闭不提醒', () => {
    const r = scan({ now: at('21:30'), reminder, enabled: false })
    expect(r.notify).toBeUndefined()
  })

  it('未设提醒不提醒', () => {
    const r = scan({ now: at('21:30') })
    expect(r.notify).toBeUndefined()
  })
})

describe('scanHabitReminder — 截止临近催促', () => {
  const reminder = { start: '21:00', end: '23:00' }

  it('剩 30 分钟内且已提醒过 → 催一次（due-soon 档）', () => {
    const first = scan({ now: at('21:00'), reminder })
    const nudge = scan({ now: at('22:35'), reminder, track: first.track })
    expect(nudge.notify).toEqual({ stage: 'due-soon' })
    expect(nudge.track.dueSoonNotified).toBe(true)
  })

  it('催促只发一次', () => {
    const first = scan({ now: at('21:00'), reminder })
    const nudge = scan({ now: at('22:35'), reminder, track: first.track })
    const again = scan({ now: at('22:45'), reminder, track: nudge.track })
    expect(again.notify).toBeUndefined()
  })

  it('截止 30 分钟外不催', () => {
    const first = scan({ now: at('21:00'), reminder })
    const r = scan({ now: at('22:00'), reminder, track: first.track })
    expect(r.notify).toBeUndefined()
  })

  it('首次扫描就处于临近截止期 → 直接以 due-soon 档补发，不双发', () => {
    const r = scan({ now: at('22:40'), reminder })
    expect(r.notify).toEqual({ stage: 'due-soon' })
    expect(r.track.startNotified).toBe(true)
  })
})

describe('scanHabitReminder — 贪睡', () => {
  const reminder = { start: '21:00', end: '23:00' }

  it('贪睡等待期内静默，到期且仍在窗口内再响', () => {
    const track: ReminderTrack = {
      ...freshTrack(DAY),
      startNotified: true,
      snoozeUntilMs: at('21:20').getTime(),
      snoozeCount: 1
    }
    const waiting = scan({ now: at('21:10'), reminder, track })
    expect(waiting.notify).toBeUndefined()

    const fired = scan({ now: at('21:20'), reminder, track })
    expect(fired.notify).toEqual({ stage: 'start' })
    expect(fired.track.snoozeUntilMs).toBeUndefined()
    expect(fired.track.snoozeCount).toBe(1) // 计数在请求侧，不在触发侧
  })

  it('贪睡到期但已过窗口 → 不响，清掉贪睡', () => {
    const track: ReminderTrack = {
      ...freshTrack(DAY),
      startNotified: true,
      snoozeUntilMs: at('23:10').getTime(),
      snoozeCount: 1
    }
    const r = scan({ now: at('23:10'), reminder, track })
    expect(r.notify).toBeUndefined()
    expect(r.track.snoozeUntilMs).toBeUndefined()
  })

  it('跨天轨迹重置：昨天的提醒状态不影响今天', () => {
    const yesterdayTrack: ReminderTrack = {
      ...freshTrack('2026-10-01'),
      startNotified: true,
      dueSoonNotified: true
    }
    const r = scan({ now: at('21:00'), reminder, track: yesterdayTrack })
    expect(r.notify).toEqual({ stage: 'start' })
    expect(r.track.date).toBe(DAY)
    expect(r.track.startNotified).toBe(true)
  })
})

describe('reminderStore — 贪睡请求侧上限', () => {
  beforeEach(() => {
    useReminderStore.setState({ tracks: {}, pending: [], suppressed: false })
  })

  it(`最多允许 ${MAX_SNOOZES} 次贪睡`, () => {
    const s = useReminderStore.getState()
    s.setTrack('h1', freshTrack(DAY))
    for (let i = 0; i < MAX_SNOOZES; i++) {
      expect(useReminderStore.getState().snooze('h1', Date.now() + SNOOZE_MINUTES * 60_000)).toBe(
        true
      )
    }
    expect(useReminderStore.getState().snooze('h1', Date.now())).toBe(false)
  })

  it('push 去重同一习惯，dismiss 移除，acknowledge 保留队列', () => {
    const s = useReminderStore.getState()
    s.push({ habitId: 'h1', name: '背单词', stage: 'start', start: '21:00', firedAt: 1 })
    s.push({ habitId: 'h1', name: '背单词', stage: 'start', start: '21:00', firedAt: 2 })
    expect(useReminderStore.getState().pending).toHaveLength(1)
    expect(useReminderStore.getState().suppressed).toBe(false)

    useReminderStore.getState().acknowledge()
    expect(useReminderStore.getState().suppressed).toBe(true)
    expect(useReminderStore.getState().pending).toHaveLength(1)

    useReminderStore.getState().dismiss('h1')
    expect(useReminderStore.getState().pending).toHaveLength(0)
  })
})

describe('工具函数', () => {
  it('suggestedReminderStart 按时段给建议值', () => {
    expect(suggestedReminderStart('morning', at('15:00'))).toBe('08:00')
    expect(suggestedReminderStart('afternoon', at('15:00'))).toBe('12:30')
    expect(suggestedReminderStart('evening', at('15:00'))).toBe('21:00')
    expect(suggestedReminderStart('any', at('15:10'))).toBe('15:00')
    expect(suggestedReminderStart('any', at('15:40'))).toBe('15:30')
  })

  it('minutesToHHmm 零填充', () => {
    expect(minutesToHHmm(0)).toBe('00:00')
    expect(minutesToHHmm(21 * 60 + 5)).toBe('21:05')
    expect(minutesToHHmm(24 * 60)).toBe('00:00')
  })
})
