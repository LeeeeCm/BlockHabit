import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Stats from './Stats'
import { useAppStore } from '../store/appStore'
import type { CheckIn, Habit } from '../types'

/**
 * 统计页拆分守门（D-20261124-082）：
 * 只钉「两种视图都真实渲染、切换后手账条目出现」，不测画布与导出细节。
 */
vi.mock('../components/Heatmap', () => ({ Heatmap: () => null }))
vi.mock('../components/GuideTip', () => ({ GuideTip: () => null }))
vi.mock('../components/MemorabiliaDialog', () => ({
  MemorabiliaDialog: () => <div data-testid="memorabilia" />
}))

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const habit: Habit = {
  id: 'h1',
  name: '阅读',
  frequency: { type: 'daily' },
  createdAt: '2026-11-01T00:00:00.000Z',
  kind: 'instant'
}

const checkIn: CheckIn = {
  id: 'c1',
  habitId: 'h1',
  date: '2026-11-20',
  at: '2026-11-20T09:00:00.000Z',
  note: '读完一章'
}

let root: Root | null = null
let container: HTMLDivElement | null = null

function renderStats(): HTMLDivElement {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<Stats />)
  })
  return container
}

function clickByText(target: HTMLElement, text: string): void {
  const button = Array.from(target.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text)
  )
  if (!button) throw new Error(`button not found: ${text}`)
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  useAppStore.setState({
    habits: [habit],
    checkIns: [checkIn],
    repairBricks: 2,
    settings: { ...useAppStore.getState().settings, language: 'zh' }
  })
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container?.remove()
  container = null
})

describe('Stats 拆分后的两种视图', () => {
  it('默认渲染指标视图：习惯名与页面标题都在', () => {
    const view = renderStats()
    expect(view.textContent).toContain('阅读')
    expect(view.textContent).toContain('指标热图')
    expect(view.querySelector('.stats-header-actions')).not.toBeNull()
  })

  it('切到手账视图后显示随笔条目与检索框', () => {
    const view = renderStats()
    clickByText(view, '手账')
    expect(view.textContent).toContain('读完一章')
    expect(view.querySelector('input[type="text"]')).not.toBeNull()
  })

  it('页头纪念品入口打开纪念品中心', () => {
    const view = renderStats()
    clickByText(view, '纪念品')
    expect(view.querySelector('[data-testid="memorabilia"]')).not.toBeNull()
  })
})
