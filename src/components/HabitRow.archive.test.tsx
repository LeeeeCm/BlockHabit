import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitRow } from './HabitRow'
import type { Habit } from '../types'
import { useAppStore } from '../store/appStore'
import { todayKey } from '../logic/dates'
import { getTranslation } from '../i18n'

const zh = getTranslation('zh')

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const habit: Habit = {
  id: 'h-archive',
  name: '健身',
  frequency: { type: 'daily' },
  kind: 'instant',
  createdAt: '2026-09-01T00:00:00.000Z'
}

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  useAppStore.setState({
    habits: [habit],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    dayClaims: []
  })
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('HabitRow 卡片归档入口（D-20261128-134）', () => {
  it('点击编辑与删除之间的归档按钮，写入 archivedAt', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root!.render(
        <HabitRow
          habit={habit}
          done={false}
          streak={0}
          day={todayKey()}
          onCheck={vi.fn()}
          onEdit={vi.fn()}
        />
      )
    })

    const button = [...container.querySelectorAll('button')].find(
      (node) => node.getAttribute('aria-label') === zh.today.archiveHabit
    )
    expect(button).toBeTruthy()
    const actionLabels = [...container.querySelectorAll('.card-action')].map((node) =>
      node.getAttribute('aria-label')
    )
    expect(actionLabels).toEqual([
      zh.today.pinHabit,
      zh.common.edit,
      zh.today.archiveHabit,
      zh.common.delete
    ])
    act(() => (button as HTMLButtonElement).click())
    expect(useAppStore.getState().habits.find((h) => h.id === habit.id)?.archivedAt).toBeTruthy()
  })
})
