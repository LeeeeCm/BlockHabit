import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayHeader } from './TodayHeader'
import { useAppStore } from '../../store/appStore'

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'zh' }
  })
  ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(
      <TodayHeader
        now={new Date(2026, 10, 24)}
        blueprintId="plant"
        placedCount={0}
        total={24}
        percent={0}
        metCount={0}
        activeCount={0}
        onNewHabit={vi.fn()}
      />
    )
  })
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
})

describe('TodayHeader 响应式结构（D-20261124-087）', () => {
  it('标题与操作组分开，窄屏可整组换行', () => {
    expect(container?.querySelector('.today-header')).not.toBeNull()
    expect(container?.querySelector('.today-header-actions')).not.toBeNull()
    expect(container?.querySelectorAll('.today-header-pill').length).toBe(2)
  })
})
