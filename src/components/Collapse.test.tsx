import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Collapse } from './Collapse'

/**
 * D-20261127-126 展开/收拢过渡容器：
 * 收起动画结束前保留子内容（让高度过渡可见），结束后卸载；reduced-motion 直接切换。
 * jsdom 下 matchMedia 默认不存在 → prefersReducedMotion() 返回 false，走动画分支。
 */

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

function render(ui: React.ReactElement) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(ui)
  })
  return {
    container,
    rerender: (next: React.ReactElement) => {
      act(() => {
        root!.render(next)
      })
    }
  }
}

function cleanup() {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
}

const originalMatchMedia = window.matchMedia

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia
  })
})

describe('Collapse 展开 / 收拢', () => {
  it('关闭态不渲染子内容', () => {
    const { container } = render(
      <Collapse open={false}>
        <span>隐藏内容</span>
      </Collapse>
    )
    expect(container.textContent).not.toContain('隐藏内容')
  })

  it('展开态渲染子内容，并带 data-open 标记', () => {
    const { container } = render(
      <Collapse open>
        <span>显示内容</span>
      </Collapse>
    )
    expect(container.textContent).toContain('显示内容')
    expect(container.querySelector('.collapse')?.getAttribute('data-open')).toBe('true')
  })

  it('从关闭切到展开：子内容挂载，下一帧进入展开态', () => {
    const { container, rerender } = render(
      <Collapse open={false}>
        <span>稍后出现</span>
      </Collapse>
    )
    expect(container.textContent).not.toContain('稍后出现')
    rerender(
      <Collapse open>
        <span>稍后出现</span>
      </Collapse>
    )
    expect(container.textContent).toContain('稍后出现')
    expect(container.querySelector('.collapse')?.getAttribute('data-open')).toBe('false')
    act(() => {
      vi.advanceTimersByTime(20)
    })
    expect(container.querySelector('.collapse')?.getAttribute('data-open')).toBe('true')
  })

  it('收起时先保留内容播放过渡，240ms 后才卸载', () => {
    const { container, rerender } = render(
      <Collapse open>
        <span>准备收起</span>
      </Collapse>
    )
    rerender(
      <Collapse open={false}>
        <span>准备收起</span>
      </Collapse>
    )
    expect(container.textContent).toContain('准备收起')
    expect(container.querySelector('.collapse')?.getAttribute('data-open')).toBe('false')
    expect(container.querySelector('.collapse')?.hasAttribute('inert')).toBe(true)
    act(() => {
      vi.advanceTimersByTime(260)
    })
    expect(container.textContent).not.toContain('准备收起')
  })

  it('reduced-motion：关闭立即卸载，不等待动画', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false
      })
    })
    const { container, rerender } = render(
      <Collapse open>
        <span>立刻收起</span>
      </Collapse>
    )
    rerender(
      <Collapse open={false}>
        <span>立刻收起</span>
      </Collapse>
    )
    expect(container.textContent).not.toContain('立刻收起')
  })
})
