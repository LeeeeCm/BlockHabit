import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectMenu } from './SelectMenu'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const options = [
  { value: 'a', label: '灰岩城堡' },
  { value: 'b', label: '绿意盆栽' }
]

let root: Root | null = null
let container: HTMLDivElement | null = null

function render(value = 'a', onChange = vi.fn()) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(
      <SelectMenu ariaLabel="选择建筑" value={value} options={options} onChange={onChange} />
    )
  })
  return { container, onChange }
}

function trigger(el: HTMLElement): HTMLButtonElement {
  return el.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  root = null
  container = null
})

describe('SelectMenu（D-20261124-089）', () => {
  it('点击触发器向下展开一体化菜单，点击选项回调并关闭', () => {
    const { container: el, onChange } = render()
    act(() => trigger(el).click())
    const list = el.querySelector('[role="listbox"]')
    expect(list).not.toBeNull()
    expect(list?.textContent).toContain('灰岩城堡')
    const option = Array.from(el.querySelectorAll('[role="option"]')).find((o) =>
      o.textContent?.includes('绿意盆栽')
    ) as HTMLElement
    act(() => option.click())
    expect(onChange).toHaveBeenCalledWith('b')
    expect(el.querySelector('[role="listbox"]')).toBeNull()
  })

  it('展开时给菜单面板加 is-open，触发高度补间', async () => {
    const { container: el } = render()
    act(() => trigger(el).click())
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    const panel = el.querySelector('.select-menu-panel')
    expect(panel).not.toBeNull()
    expect(panel?.classList.contains('is-open')).toBe(true)
  })

  it('键盘 ↑↓ + Enter 可选择，Esc 关闭', () => {
    const { container: el, onChange } = render()
    const btn = trigger(el)
    act(() => {
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(el.querySelector('[role="listbox"]')).not.toBeNull()
    act(() => {
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('a')
    expect(el.querySelector('[role="listbox"]')).toBeNull()

    act(() => {
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    expect(el.querySelector('[role="listbox"]')).not.toBeNull()
    act(() => {
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(el.querySelector('[role="listbox"]')).toBeNull()
  })

  it('点击外部关闭', () => {
    const { container: el } = render()
    act(() => trigger(el).click())
    expect(el.querySelector('[role="listbox"]')).not.toBeNull()
    act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    expect(el.querySelector('[role="listbox"]')).toBeNull()
  })
})
