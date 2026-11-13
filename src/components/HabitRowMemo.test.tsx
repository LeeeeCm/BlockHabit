import { act, memo } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HabitRow } from './HabitRow'
import { useAppStore } from '../store/appStore'
import { clearHabitSliceCache } from '../store/habitSelectors'
import { todayKey } from '../logic/dates'
import type { Habit } from '../types'

describe('HabitRow memo & slice isolation', () => {
  let container: HTMLDivElement

  const h1: Habit = {
    id: 'h1',
    name: '晨跑',
    frequency: { type: 'daily' },
    createdAt: '2026-09-01T00:00:00.000Z'
  }

  const h2: Habit = {
    id: 'h2',
    name: '阅读',
    frequency: { type: 'daily' },
    createdAt: '2026-09-01T00:00:00.000Z'
  }

  // store 的 checkIn 使用真实 todayKey，测试的 day 必须一致（勿硬编码日期）
  const day = todayKey()
  const stableOnCheck = vi.fn()
  const stableOnEdit = vi.fn()

  beforeEach(() => {
    clearHabitSliceCache()
    container = document.createElement('div')
    document.body.appendChild(container)
    useAppStore.setState({
      habits: [h1, h2],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant'
    })
  })

  afterEach(() => {
    if (container.parentElement) {
      document.body.removeChild(container)
    }
  })

  it('renders HabitRow with React.memo and does not re-render h1 when h2 checks in', () => {
    let h1Renders = 0
    let h2Renders = 0

    const TrackedRow1 = memo((props: Parameters<typeof HabitRow>[0]) => {
      h1Renders++
      return <HabitRow {...props} />
    })

    const TrackedRow2 = memo((props: Parameters<typeof HabitRow>[0]) => {
      h2Renders++
      return <HabitRow {...props} />
    })

    function TestList() {
      const checkIns = useAppStore((s) => s.checkIns)
      const done1 = checkIns.some((c) => !c.deletedAt && c.habitId === 'h1' && c.date === day)
      const done2 = checkIns.some((c) => !c.deletedAt && c.habitId === 'h2' && c.date === day)

      return (
        <div>
          <TrackedRow1
            habit={h1}
            day={day}
            done={done1}
            streak={0}
            inRestPeriod={false}
            onCheck={stableOnCheck}
            onEdit={stableOnEdit}
          />
          <TrackedRow2
            habit={h2}
            day={day}
            done={done2}
            streak={0}
            inRestPeriod={false}
            onCheck={stableOnCheck}
            onEdit={stableOnEdit}
          />
        </div>
      )
    }

    const root = createRoot(container)
    act(() => {
      root.render(<TestList />)
    })

    // Both rows rendered initially once
    expect(container.textContent).toContain('晨跑')
    expect(container.textContent).toContain('阅读')
    expect(h1Renders).toBe(1)
    expect(h2Renders).toBe(1)

    // Check in h2 in store
    act(() => {
      useAppStore.getState().checkIn('h2')
    })

    // Habit 2 re-rendered to reflect done state
    expect(h2Renders).toBe(2)
    // Habit 1 was SKIPPED by memo (h1Renders remains exactly 1)
    expect(h1Renders).toBe(1)

    // Now check in h1 in store
    act(() => {
      useAppStore.getState().checkIn('h1')
    })

    // Habit 1 re-rendered to reflect done state
    expect(h1Renders).toBe(2)
    // Habit 2 was SKIPPED by memo (h2Renders remains 2)
    expect(h2Renders).toBe(2)

    act(() => {
      root.unmount()
    })
  })
})
