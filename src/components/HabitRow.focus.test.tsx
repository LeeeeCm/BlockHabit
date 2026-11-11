import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitRow } from './HabitRow'
import type { Habit } from '../types'
import { useAppStore } from '../store/appStore'
import { useTimerStore } from '../store/timerStore'
import { getTranslation } from '../i18n'

/**
 * B4 回归（D-20261110-064 收尾）：摆件可把会话「再等 5 分钟」延长，
 * 今日页 HabitRow 必须用含延长的有效目标判断 running/ended ——
 * 否则会在原目标提前显示确认态（用户看到「到点」但摆件还在倒计时）。
 * 用 fake timers 固定 now，不真实等待。
 */
const MINUTE = 60_000
const TARGET_MINUTES = 25
const BASE_MS = new Date('2026-09-30T09:00:00+08:00').getTime()
const DAY = '2026-09-30'

const focusHabit: Habit = {
  id: 'h-focus',
  name: '深度阅读',
  frequency: { type: 'daily' },
  kind: 'focus',
  targetMinutes: TARGET_MINUTES,
  createdAt: '2026-09-01T00:00:00.000Z',
}

const zh = getTranslation('zh')

function renderRow() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<HabitRow habit={focusHabit} done={false} streak={0} day={DAY} onCheck={vi.fn()} />)
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('HabitRow 专注会话同步（B4 回归）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_MS)
    localStorage.clear()
    useTimerStore.setState({ sessions: {} })
    useAppStore.setState({
      habits: [focusHabit],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: [],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('延长一次后仍显示「进行中/剩余」，不会在原目标提前进入确认态', () => {
    useTimerStore.getState().start(focusHabit.id, TARGET_MINUTES * MINUTE)
    expect(useTimerStore.getState().extend(focusHabit.id)).toBe(true) // extensions=1 → 有效 30 分钟
    // 已过原目标（25 分钟），但离延长后的有效目标还有 4 分钟
    vi.setSystemTime(BASE_MS + 26 * MINUTE)

    const { container, unmount } = renderRow()
    const text = container.textContent ?? ''
    // 进行中：显示已专注分钟 + 剩余倒计时（04:00）
    expect(text).toContain(zh.today.focusedMinutes(26))
    expect(text).toMatch(/04:00|03:5\d/)
    // 不显示到点确认态的可见文案
    expect(text).not.toContain(zh.today.timingTooltip)
    unmount()
  })

  it('未延长时同一时刻（26 分钟）已是确认态 —— 证明上面的用例确实在测延长同步', () => {
    useTimerStore.getState().start(focusHabit.id, TARGET_MINUTES * MINUTE)
    vi.setSystemTime(BASE_MS + 26 * MINUTE)

    const { container, unmount } = renderRow()
    const text = container.textContent ?? ''
    expect(text).toContain(zh.today.timingTooltip)
    expect(text).not.toContain(zh.today.focusedMinutes(26))
    unmount()
  })

  it('延长后的有效目标到点才显示确认态（30 分钟整）', () => {
    useTimerStore.getState().start(focusHabit.id, TARGET_MINUTES * MINUTE)
    expect(useTimerStore.getState().extend(focusHabit.id)).toBe(true)
    vi.setSystemTime(BASE_MS + 30 * MINUTE)

    const { container, unmount } = renderRow()
    const text = container.textContent ?? ''
    expect(text).toContain(zh.today.timingTooltip)
    const confirm = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === zh.common.complete,
    )
    expect(confirm).toBeTruthy()
    unmount()
  })

  it('延长两次后有效目标 35 分钟：第 31 分钟仍在进行中，第 35 分钟才确认', () => {
    useTimerStore.getState().start(focusHabit.id, TARGET_MINUTES * MINUTE)
    expect(useTimerStore.getState().extend(focusHabit.id)).toBe(true)
    expect(useTimerStore.getState().extend(focusHabit.id)).toBe(true) // extensions=2 → 有效 35 分钟

    vi.setSystemTime(BASE_MS + 31 * MINUTE)
    const first = renderRow()
    expect(first.container.textContent).toContain(zh.today.focusedMinutes(31))
    expect(first.container.textContent).toMatch(/04:00|03:5\d/)
    expect(first.container.textContent).not.toContain(zh.today.timingTooltip)
    first.unmount()

    vi.setSystemTime(BASE_MS + 35 * MINUTE)
    const second = renderRow()
    expect(second.container.textContent).toContain(zh.today.timingTooltip)
    second.unmount()
  })
})
