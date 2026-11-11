import { act, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDialogA11y, type DialogA11yOptions } from './useDialogA11y'

function TestDialog(props: DialogA11yOptions) {
  const { ref } = useDialogA11y(props)
  if (!props.open) return null
  return (
    <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
      <button id="btn1">Button 1</button>
      <input id="input1" />
      <button id="btn2">Button 2</button>
    </div>
  )
}

function AutoFocusDialog(props: DialogA11yOptions) {
  const { ref } = useDialogA11y(props)
  const inputRef = useRef<HTMLInputElement>(null)
  // 子组件 effect 先于父组件 effect 执行：模拟 React autoFocus 在 commit 阶段已把焦点放进面板
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  if (!props.open) return null
  return (
    <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
      <input id="auto-input" ref={inputRef} />
    </div>
  )
}

describe('useDialogA11y hook', () => {
  let container: HTMLDivElement
  let origOffsetWidth: PropertyDescriptor | undefined
  let origOffsetHeight: PropertyDescriptor | undefined

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)

    origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
    origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')

    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 100,
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 40,
    })
  })

  afterEach(() => {
    if (origOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origOffsetWidth)
    } else {
      delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth
    }
    if (origOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeight)
    } else {
      delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
    }
    document.body.removeChild(container)
  })

  it('triggers onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    const root = createRoot(container)

    act(() => {
      root.render(<TestDialog open={true} onClose={onClose} />)
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    act(() => {
      root.unmount()
    })
  })

  it('traps focus inside the dialog with Tab and Shift+Tab', () => {
    const root = createRoot(container)

    act(() => {
      root.render(<TestDialog open={true} onClose={vi.fn()} />)
    })

    const btn1 = document.getElementById('btn1') as HTMLButtonElement
    const btn2 = document.getElementById('btn2') as HTMLButtonElement

    // 焦点在末尾元素，按 Tab 循环回首个可聚焦元素
    btn2.focus()
    expect(document.activeElement).toBe(btn2)

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    window.dispatchEvent(tabEvent)
    expect(tabEvent.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(btn1)

    // 焦点在首个元素，按 Shift+Tab 循环至末尾可聚焦元素
    btn1.focus()
    expect(document.activeElement).toBe(btn1)

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(shiftTabEvent)
    expect(shiftTabEvent.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(btn2)

    act(() => {
      root.unmount()
    })
  })

  it('不抢走面板内已聚焦的输入框（C6：autoFocus 保留）', () => {
    const root = createRoot(container)
    act(() => {
      root.render(<AutoFocusDialog open={true} onClose={vi.fn()} />)
    })
    expect(document.activeElement?.id).toBe('auto-input')
    act(() => {
      root.unmount()
    })
  })

  it('restores focus to previously active element on close', () => {
    const triggerBtn = document.createElement('button')
    triggerBtn.id = 'trigger'
    container.appendChild(triggerBtn)
    triggerBtn.focus()
    expect(document.activeElement).toBe(triggerBtn)

    const dialogHost = document.createElement('div')
    container.appendChild(dialogHost)
    const root = createRoot(dialogHost)

    act(() => {
      root.render(<TestDialog open={true} onClose={vi.fn()} />)
    })

    // 弹窗打开后，焦点移入弹窗内面板
    expect(document.activeElement).not.toBe(triggerBtn)

    // 弹窗关闭
    act(() => {
      root.render(<TestDialog open={false} onClose={vi.fn()} />)
    })

    // 焦点恢复到 triggerBtn
    expect(document.activeElement).toBe(triggerBtn)

    act(() => {
      root.unmount()
    })
  })
})
