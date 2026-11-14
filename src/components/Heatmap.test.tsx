import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Heatmap } from './Heatmap'
import { useAppStore } from '../store/appStore'
import type { Habit } from '../types'

/**
 * C5 回归：热图键盘可达。
 * 13 周 × 7 天 = 91 格；若全部进 tab 序列，多习惯统计页会有 500+ 个停留点。
 * 现在整张热图只占 1 个 tab 停留点（roving tabindex），方向键在格间移动。
 */
const habit: Habit = {
  id: 'h1',
  name: '读书',
  frequency: { type: 'daily' },
  createdAt: '2026-01-01T00:00:00.000Z'
}

describe('Heatmap 键盘可达（C5）', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null = null

  beforeEach(() => {
    // 热图网格以「本周」结尾（13 周 × 7 天）。若测试恰好在周日跑，本周 7 天全是今天或过去，
    // 网格里一个「未来日期」都没有 → 下面的 aria-disabled 用例会找不到禁用格（历史随机 flake）。
    // 固定到周三（2026-11-11），本周仍有 4 个未来日，断言与产品行为都不变。
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T10:00:00'))
    useAppStore.setState({ settings: { theme: 'light', language: 'zh' } })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root?.unmount())
    document.body.removeChild(container)
    root = null
    vi.useRealTimers()
  })

  function render(onDayClick = vi.fn()) {
    act(() => {
      root?.render(
        <Heatmap
          habits={[habit]}
          checkIns={[]}
          habitId={habit.id}
          cell={13}
          weeks={13}
          onDayClick={onDayClick}
        />
      )
    })
    return Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
  }

  it('整张热图只有一个 tab 停留点（91 格中仅 1 格 tabIndex=0）', () => {
    const cells = render()
    expect(cells).toHaveLength(91)
    const tabbable = cells.filter((c) => c.tabIndex === 0)
    expect(tabbable).toHaveLength(1)
  })

  it('方向键在格子间移动焦点（上下 = ±1 天，左右 = ±7 天）', () => {
    const cells = render()
    const press = (key: string) => {
      const el = cells.find((c) => c.tabIndex === 0) as HTMLButtonElement
      act(() => {
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
      })
      return cells.find((c) => c.tabIndex === 0) as HTMLButtonElement
    }

    // 先 Home 到本周周一（保证左右移动不会越界），再验证三种位移
    const monday = press('Home')
    const startIdx = cells.indexOf(monday)
    expect(startIdx % 7).toBe(0)

    const down = press('ArrowDown')
    expect(cells.indexOf(down)).toBe(startIdx + 1)
    expect(document.activeElement).toBe(down)

    const up = press('ArrowUp')
    expect(cells.indexOf(up)).toBe(startIdx)

    const left = press('ArrowLeft')
    expect(cells.indexOf(left)).toBe(startIdx - 7)
    expect(document.activeElement).toBe(left)

    const right = press('ArrowRight')
    expect(cells.indexOf(right)).toBe(startIdx)
  })

  it('Home / End 跳到本周首尾', () => {
    const cells = render()
    let current = cells.find((c) => c.tabIndex === 0) as HTMLButtonElement
    act(() => {
      current.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })
      )
    })
    current = cells.find((c) => c.tabIndex === 0) as HTMLButtonElement
    expect(cells.indexOf(current) % 7).toBe(0)

    act(() => {
      current.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
      )
    })
    current = cells.find((c) => c.tabIndex === 0) as HTMLButtonElement
    expect(cells.indexOf(current) % 7).toBe(6)
  })

  it('不可操作的格子用 aria-disabled 表达（仍可聚焦，读屏可念），点击不触发回调', () => {
    const onDayClick = vi.fn()
    const cells = render(onDayClick)
    // 未来日期：ratio = -1 且 future，clickable=false
    const disabledCell = cells.find(
      (c) => c.getAttribute('aria-disabled') === 'true'
    ) as HTMLButtonElement
    expect(disabledCell).toBeDefined()
    expect(disabledCell.disabled).toBe(false)
    act(() => {
      disabledCell.click()
    })
    expect(onDayClick).not.toHaveBeenCalled()
  })

  it('容器有可访问名称（role=group + aria-label）', () => {
    render()
    const group = container.querySelector('[role="group"]')
    expect(group).not.toBeNull()
    expect(group?.getAttribute('aria-label')).toContain('13 周')
  })
})
