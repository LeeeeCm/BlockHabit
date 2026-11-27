import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitRow } from './HabitRow'
import type { CheckIn, Habit } from '../types'
import { useAppStore } from '../store/appStore'
import { todayKey } from '../logic/dates'
import { getTranslation } from '../i18n'

/**
 * D-20261128-132：打卡成功后的随笔编辑。
 * 回归点：键盘输入、鼠标移出卡片、焦点变化都不能取消编辑；
 * 只有点击随笔模块外一次才取消。
 */
const zh = getTranslation('zh')

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const habit: Habit = {
  id: 'h-note',
  name: '读书',
  frequency: { type: 'daily' },
  kind: 'instant',
  createdAt: '2026-09-01T00:00:00.000Z'
}

let day = ''
let checkIn: CheckIn
let root: Root | null = null
let container: HTMLDivElement | null = null

function renderRow() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <HabitRow habit={habit} done streak={1} day={day} onCheck={vi.fn()} onEdit={vi.fn()} />
    )
  })
  return container
}

function openEditor(view: HTMLElement) {
  const placeholder = [...view.querySelectorAll('span')].find(
    (el) => el.textContent === zh.today.addReflectionPlaceholder
  )
  expect(placeholder).toBeTruthy()
  act(() => (placeholder as HTMLElement).click())
  const input = view.querySelector('.micro-note-input') as HTMLInputElement | null
  expect(input).not.toBeNull()
  return input!
}

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  day = todayKey()
  checkIn = {
    id: 'c-note',
    habitId: habit.id,
    date: day,
    at: new Date().toISOString(),
    blueprintId: 'plant'
  }
  useAppStore.setState({
    habits: [habit],
    checkIns: [checkIn],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: []
  })
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  container?.remove()
  root = null
  container = null
})

describe('HabitRow 打卡随笔编辑（D-20261128-132）', () => {
  it('键盘输入不会取消编辑，输入值保留', () => {
    const view = renderRow()
    const input = openEditor(view)
    typeInto(input, '今天完成了')
    expect((view.querySelector('.micro-note-input') as HTMLInputElement).value).toBe('今天完成了')
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    })
    expect(view.querySelector('.micro-note-input')).toBe(input)
  })

  it('鼠标移出卡片不会取消编辑', () => {
    const view = renderRow()
    const input = openEditor(view)
    const card = view.querySelector('.habit-card') as HTMLElement
    act(() => {
      card.dispatchEvent(
        new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })
      )
    })
    expect(view.querySelector('.micro-note-input')).toBe(input)
  })

  it('点击模块外一次才取消并恢复摘要态', () => {
    const view = renderRow()
    const input = openEditor(view)
    typeInto(input, '今天完成了')
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(view.querySelector('.micro-note-input')).toBeNull()
    expect(view.textContent).toContain(zh.today.addReflectionPlaceholder)
  })

  it('点击模块内部不会取消', () => {
    const view = renderRow()
    const input = openEditor(view)
    act(() => {
      input.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    })
    expect(view.querySelector('.micro-note-input')).toBe(input)
  })
})
