import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayHabitSections } from './TodayHabitSections'
import { useAppStore } from '../../store/appStore'
import { useTimerStore } from '../../store/timerStore'
import { getTranslation } from '../../i18n'
import type { CheckIn, Habit, HabitPeriod } from '../../types'

/**
 * 回归：任意时段 / 周频习惯的打卡死点。
 * 根因是卡片 done 只看「今天有打卡」，而周频配额满后点击被 weekly-full 静默拒绝。
 */
const zh = getTranslation('zh')
const DAY = '2026-09-30' // 周三
// 用本地时间构造：避免 CI 时区不同导致 todayKey() 落在 9-29 而测试仍误通过
const BASE_MS = new Date(2026, 8, 30, 12, 0, 0).getTime()
const roots: Array<() => void> = []

function habit(over: Partial<Habit>): Habit {
  return {
    id: 'h1',
    name: '健身',
    frequency: { type: 'weekly', times: 3 },
    period: 'any',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...over
  }
}

function ci(date: string, id = date): CheckIn {
  return { id, habitId: 'h1', date, at: `${date}T08:00:00.000Z` }
}

function renderSections(h: Habit, checkIns: CheckIn[], onBlocked = vi.fn(), onCheck = vi.fn()) {
  useAppStore.setState({
    habits: [h],
    checkIns,
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    dayClaims: [],
    settings: { theme: 'light', language: 'zh' }
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <TodayHabitSections
        grouped={
          new Map<HabitPeriod, Habit[]>([
            ['any', [h]],
            ['morning', []],
            ['afternoon', []],
            ['evening', []]
          ])
        }
        checkIns={checkIns}
        now={new Date(BASE_MS)}
        day={DAY}
        enableGentleDecay={false}
        onCheck={onCheck}
        onBlocked={onBlocked}
        onNoteSaved={vi.fn()}
        onEdit={vi.fn()}
      />
    )
  })
  const unmount = () => {
    if (container.dataset.unmounted) return
    container.dataset.unmounted = '1'
    act(() => root.unmount())
    container.remove()
  }
  roots.push(unmount)
  return {
    container,
    card: () => container.querySelector('.habit-card') as HTMLElement,
    unmount
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BASE_MS)
  localStorage.clear()
  useTimerStore.setState({ sessions: {} })
})

afterEach(() => {
  // 断言失败时也确保根节点卸载，避免离屏卡片继续订阅 zustand
  for (const unmount of roots.splice(0)) unmount()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('周频打卡死点回归', () => {
  it('本周配额已满（今天没打卡）：卡片显示完成与「本周 2/2」，不再可点', () => {
    const checkIns = [ci('2026-09-28'), ci('2026-09-29')]
    const onBlocked = vi.fn()
    const onCheck = vi.fn()
    const view = renderSections(
      habit({ frequency: { type: 'weekly', times: 2 } }),
      checkIns,
      onBlocked,
      onCheck
    )
    const text = view.card().textContent ?? ''
    expect(text).toContain(zh.today.weekProgress(2, 2))
    expect(text).not.toContain(zh.today.checkInTooltip)
    expect(view.card().querySelector('.status-btn')?.getAttribute('title')).toBe(
      zh.today.weekDoneTooltip
    )
    act(() => view.card().click())
    expect(onCheck).not.toHaveBeenCalled()
    expect(onBlocked).not.toHaveBeenCalled()
    expect(useAppStore.getState().checkIns).toHaveLength(2)
    view.unmount()
  })

  it('今日已打卡但配额未满：显示「今日已打卡 · 本周 2/3」，点击给出 already 回执', () => {
    const checkIns = [ci('2026-09-28'), ci('2026-09-30')]
    const onBlocked = vi.fn()
    const view = renderSections(
      habit({ frequency: { type: 'weekly', times: 3 } }),
      checkIns,
      onBlocked
    )
    const text = view.card().textContent ?? ''
    expect(text).toContain(zh.today.weekProgressToday(2, 3))
    act(() => view.card().click())
    expect(onBlocked).toHaveBeenCalledWith('already', expect.objectContaining({ id: 'h1' }))
    expect(useAppStore.getState().checkIns).toHaveLength(2)
    view.unmount()
  })

  it('普通待打卡：没有提示式胶囊，点击仍能正常打卡（不破坏主路径）', () => {
    const onCheck = vi.fn()
    const onBlocked = vi.fn()
    const view = renderSections(habit({ frequency: { type: 'daily' } }), [], onBlocked, onCheck)
    const text = view.card().textContent ?? ''
    expect(text).not.toContain(zh.today.checkInTooltip)
    expect(text).not.toContain(zh.today.weekProgress(0, 3))
    act(() => view.card().click())
    expect(onBlocked).not.toHaveBeenCalled()
    expect(onCheck).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().checkIns).toHaveLength(1)
    expect(useAppStore.getState().checkIns[0].date).toBe(DAY)
    view.unmount()
  })
})
