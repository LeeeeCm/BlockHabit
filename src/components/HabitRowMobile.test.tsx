import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { HabitRow } from './HabitRow'
import type { Habit } from '../types'
import * as platform from '../platform'
import * as detectModule from '../platform/detect'
import { useAppStore } from '../store/appStore'
import { todayKey } from '../logic/dates'

function render(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
    getByRole: (role: string, name?: RegExp | string) => {
      const elements = container.querySelectorAll(role === 'button' ? 'button' : role)
      for (const el of elements) {
        if (!name) return el as HTMLElement
        const text = el.textContent ?? ''
        const title = el.getAttribute('title') ?? ''
        const ariaLabel = el.getAttribute('aria-label') ?? ''
        const target = `${text} ${title} ${ariaLabel}`
        if (typeof name === 'string' && target.includes(name)) return el as HTMLElement
        if (name instanceof RegExp && name.test(target)) return el as HTMLElement
      }
      throw new Error(`Element with role "${role}" and name "${name}" not found`)
    }
  }
}

describe('HabitRow Mobile interaction & touch feedback', () => {
  let hapticSpy: MockInstance

  const standardHabit: Habit = {
    id: 'h-daily',
    name: '晨间饮水',
    frequency: { type: 'daily' },
    kind: 'instant',
    createdAt: '2026-09-01T00:00:00Z'
  }

  const counterHabit: Habit = {
    id: 'h-counter',
    name: '每日喝水',
    frequency: { type: 'daily' },
    kind: 'counter',
    targetValue: 2000,
    unit: 'ml',
    step: 250,
    createdAt: '2026-09-01T00:00:00Z'
  }

  const focusHabit: Habit = {
    id: 'h-focus',
    name: '深度阅读',
    frequency: { type: 'daily' },
    kind: 'focus',
    targetMinutes: 25,
    createdAt: '2026-09-01T00:00:00Z'
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(detectModule, 'detectPlatform').mockReturnValue('mobile')
    hapticSpy = vi.spyOn(platform, 'triggerHaptic').mockImplementation(() => {})
    useAppStore.setState({
      habits: [standardHabit, counterHabit, focusHabit],
      checkIns: [],
      builds: [],
      activeBlueprintId: 'plant',
      completedBlueprintIds: [],
      settings: { theme: 'light', language: 'zh' },
      dayClaims: []
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('verifies mobile touch target sizing (all buttons have minimum touch size >= 44x44px or proper touch paddings)', () => {
    const { container, unmount } = render(
      <HabitRow
        habit={standardHabit}
        done={false}
        streak={2}
        day={todayKey()}
        onCheck={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
    expect(buttons.length).toBeGreaterThanOrEqual(4) // status, pin, edit, delete

    for (const btn of buttons) {
      const minW = parseInt(btn.style.minWidth || btn.style.width || '0', 10)
      const minH = parseInt(btn.style.minHeight || btn.style.height || '0', 10)
      const hasProperDimension = minW >= 44 && minH >= 44
      const hasTouchPadding = btn.style.padding && btn.style.padding.includes('10px')

      expect(hasProperDimension || hasTouchPadding).toBe(true)
    }

    unmount()
  })

  it('verifies haptic feedback triggered on checkin click (triggerHaptic("medium"))', () => {
    const onCheck = vi.fn()
    const { container, unmount } = render(
      <HabitRow habit={standardHabit} done={false} streak={3} day={todayKey()} onCheck={onCheck} />
    )

    const statusBtn = container.querySelector('.status-btn') as HTMLButtonElement
    expect(statusBtn).toBeDefined()

    act(() => {
      statusBtn.click()
    })

    expect(hapticSpy).toHaveBeenCalledWith('medium')
    expect(onCheck).toHaveBeenCalled()
    unmount()
  })

  it('verifies counter step (+/-) buttons trigger haptic feedback', () => {
    const onCheck = vi.fn()
    const { getByRole, unmount } = render(
      <HabitRow habit={counterHabit} done={false} streak={0} day={todayKey()} onCheck={onCheck} />
    )

    const stepPlusBtn = getByRole('button', /\+250/)
    const stepMinusBtn = getByRole('button', /-250/)

    expect(stepPlusBtn).toBeDefined()
    expect(stepMinusBtn).toBeDefined()

    // Test + button
    act(() => {
      stepPlusBtn.click()
    })
    expect(hapticSpy).toHaveBeenCalledWith('light')

    hapticSpy.mockClear()

    // Test - button
    act(() => {
      stepMinusBtn.click()
    })
    expect(hapticSpy).toHaveBeenCalledWith('light')

    unmount()
  })

  it('verifies active press animation or CSS class', () => {
    const { container, unmount } = render(
      <HabitRow habit={standardHabit} done={false} streak={1} day={todayKey()} />
    )

    const card = container.querySelector('.habit-card') as HTMLElement
    expect(card).toBeDefined()
    expect(card.classList.contains('mobile')).toBe(true)

    unmount()
  })

  it('verifies focus habit timer trigger button meets mobile touch targets', () => {
    const { container, unmount } = render(
      <HabitRow habit={focusHabit} done={false} streak={0} day={todayKey()} />
    )

    const focusBtn = container.querySelector('.pill-action') as HTMLButtonElement
    expect(focusBtn).toBeDefined()
    const minW = parseInt(focusBtn.style.minWidth || '0', 10)
    const minH = parseInt(focusBtn.style.minHeight || '0', 10)
    expect(minW >= 44 && minH >= 44).toBe(true)
    expect(focusBtn.style.padding).toContain('10px')

    unmount()
  })

  it('verifies card click on mobile triggers checkin and haptic', () => {
    const onCheck = vi.fn()
    const { container, unmount } = render(
      <HabitRow habit={standardHabit} done={false} streak={1} day={todayKey()} onCheck={onCheck} />
    )

    const card = container.querySelector('.habit-card') as HTMLElement
    act(() => {
      card.click()
    })

    expect(hapticSpy).toHaveBeenCalledWith('medium')
    expect(onCheck).toHaveBeenCalled()

    unmount()
  })

  it('verifies desktop mode does not apply mobile class or oversized buttons', () => {
    vi.spyOn(detectModule, 'detectPlatform').mockReturnValue('desktop')
    const { container, unmount } = render(
      <HabitRow habit={standardHabit} done={false} streak={1} day={todayKey()} />
    )

    const card = container.querySelector('.habit-card') as HTMLElement
    expect(card.classList.contains('mobile')).toBe(false)

    const statusBtn = container.querySelector('.status-btn') as HTMLButtonElement
    expect(statusBtn.style.width).toBe('40px')
    expect(statusBtn.style.height).toBe('40px')
    expect(statusBtn.style.minWidth).toBe('')

    unmount()
  })
})
