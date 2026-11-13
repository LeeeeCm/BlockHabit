import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuideTip } from './GuideTip'

function renderTip(ui: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
    note: () => container.querySelector('[role="note"]') as HTMLElement | null
  }
}

function baseProps() {
  return {
    title: '这是你的工地',
    body: '滚轮缩放、拖拽平移；落下的积木会按蓝图逐块咬合。',
    dismissLabel: '知道了',
    onDismiss: vi.fn()
  }
}

/**
 * D-20261110-054：GuideTip 提示卡。
 * 视觉契约（固定/内联两种变体的位置）、无障碍（role=note、Esc、不抢焦点）、
 * 以及「默认无动画」（同时满足 prefers-reduced-motion）都在这里钉住。
 */
describe('GuideTip', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('渲染标题、正文与「知道了」按钮，容器是 role=note', () => {
    const props = baseProps()
    const { note, unmount } = renderTip(<GuideTip {...props} />)
    const el = note()
    expect(el).not.toBeNull()
    expect(el?.textContent).toContain('这是你的工地')
    expect(el?.textContent).toContain('滚轮缩放')
    expect(el?.querySelector('button')?.textContent).toBe('知道了')
    unmount()
  })

  it('fixed 变体：左下角浮起，避开 64px tabbar、zIndex 低于弹窗', () => {
    const props = baseProps()
    const { note, unmount } = renderTip(<GuideTip {...props} variant="fixed" />)
    const el = note() as HTMLElement
    expect(el.style.position).toBe('fixed')
    expect(el.style.left).toBe('20px')
    expect(el.style.bottom).toBe('84px')
    expect(el.style.maxWidth).toBe('320px')
    expect(el.style.zIndex).toBe('60')
    expect(el.style.borderRadius).toBe('var(--r-md)')
    expect(el.style.boxShadow).toBe('0 2px 8px rgba(0,0,0,0.06)')
    unmount()
  })

  it('inline 变体：常规文档流，margin 12px 0', () => {
    const props = baseProps()
    const { note, unmount } = renderTip(<GuideTip {...props} variant="inline" />)
    const el = note() as HTMLElement
    expect(el.style.position).toBe('static')
    expect(el.style.margin).toBe('12px 0px')
    expect(el.style.left).toBe('')
    expect(el.style.bottom).toBe('')
    unmount()
  })

  it('点「知道了」触发 onDismiss', () => {
    const props = baseProps()
    const { note, unmount } = renderTip(<GuideTip {...props} />)
    const button = note()?.querySelector('button') as HTMLButtonElement
    act(() => button.click())
    expect(props.onDismiss).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('Esc 关闭', () => {
    const props = baseProps()
    const { unmount } = renderTip(<GuideTip {...props} />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(props.onDismiss).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('卸载后不再监听 Esc', () => {
    const props = baseProps()
    const { unmount } = renderTip(<GuideTip {...props} />)
    unmount()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(props.onDismiss).not.toHaveBeenCalled()
  })

  it('弹窗打开时 Esc 归弹窗，不同时关掉提示', () => {
    const props = baseProps()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialog)
    const { unmount } = renderTip(<GuideTip {...props} />)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(props.onDismiss).not.toHaveBeenCalled()
    unmount()
  })

  it('不主动抢焦点', () => {
    const props = baseProps()
    const { unmount } = renderTip(<GuideTip {...props} />)
    expect(document.activeElement).toBe(document.body)
    unmount()
  })

  it('无动画/过渡（默认即满足 prefers-reduced-motion）', () => {
    const props = baseProps()
    const { note, unmount } = renderTip(<GuideTip {...props} />)
    const el = note() as HTMLElement
    expect(el.style.transition).toBe('')
    expect(el.style.animation).toBe('')
    unmount()
  })
})
