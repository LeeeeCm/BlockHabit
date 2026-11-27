import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimeWheelPicker } from './TimeWheelPicker'

/**
 * D-20261126-116：折叠式时间滚轮（取代 D-20261126-115 的常驻三行形态）。
 *
 * 锁定四件对外行为：
 * 1. 语义：两列都是 spinbutton，取值范围与当前值可读；
 * 2. 折叠：常态只有一行（未带 is-open），点击后展开成三行并加聚焦态；
 * 3. 步进：滚轮一格 = 一行，分钟首尾循环，键盘同样可用；
 * 4. 收起：点外部 / Esc / 焦点离开都会收回一行。
 */

vi.mock('../audio/sound', () => ({ playSnapSound: vi.fn() }))
vi.mock('../platform', () => ({ triggerHaptic: vi.fn() }))

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
      act(() => root.unmount())
      container.remove()
    }
  }
}

const ROW = 26
/** 视口 3 行时，scrollTop=0 处中心行是第 1 行 */
const CENTER = 1

/** 当前位移：组件把位移写成 track 的 translate3d */
function offsetOf(col: HTMLElement): number {
  const track = col.querySelector('.tw-track') as HTMLElement | null
  const m = /translate3d\(0(?:px)?, (-?[\d.]+)px/.exec(track?.style.transform ?? '')
  return m ? Math.abs(Number(m[1])) : 0
}

/**
 * 先点一下控件展开（D-20261126-120：未点击时滚轮不归控件），再滚一格并等落位。
 * clientX/clientY 落在控件范围内，否则会被判为「指针在控件外」而放行给页面。
 */
async function notched(col: HTMLElement, deltaY = 120) {
  const root = col.closest('.tw') as HTMLElement
  const rect = root.getBoundingClientRect()
  const clientX = rect.left + rect.width / 2
  const clientY = rect.top + rect.height / 2
  await act(async () => {
    root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 30))
    col.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY,
        deltaMode: 0,
        bubbles: true,
        cancelable: true,
        clientX,
        clientY
      })
    )
    await new Promise((r) => setTimeout(r, 260))
  })
}

function columns(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.tw-col')) as HTMLElement[]
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('TimeWheelPicker（D-20261126-116）', () => {
  it('渲染小时 / 分钟两列循环滚轮，语义为 spinbutton', () => {
    const { container, unmount } = render(
      <TimeWheelPicker
        value="21:00"
        onChange={vi.fn()}
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const cols = columns(container)
    expect(cols.length).toBe(2)
    expect(cols[0].getAttribute('role')).toBe('spinbutton')
    expect(cols[0].getAttribute('aria-valuemax')).toBe('23')
    expect(cols[0].getAttribute('aria-valuenow')).toBe('21')
    expect(cols[1].getAttribute('aria-valuemax')).toBe('59')
    expect(cols[1].getAttribute('aria-valuenow')).toBe('0')
    // 首尾循环：清单长度是取值个数的三倍
    expect(cols[0].querySelectorAll('.tw-item').length).toBe(72)
    expect(cols[1].querySelectorAll('.tw-item').length).toBe(180)
    unmount()
  })

  it('常态收起为一行，点击后展开成三行并标记聚焦态', async () => {
    const { container, unmount } = render(
      <TimeWheelPicker
        value="21:00"
        onChange={vi.fn()}
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const root = container.querySelector('.tw') as HTMLElement
    expect(root.classList.contains('is-open')).toBe(false)
    expect(root.querySelector('.tw-view')?.classList.contains('is-expanded')).toBe(false)

    await act(async () => {
      root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(root.classList.contains('is-open')).toBe(true)
    expect(root.querySelector('.tw-view')?.classList.contains('is-expanded')).toBe(true)

    // 点外部收起
    await act(async () => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(root.classList.contains('is-open')).toBe(false)
    unmount()
  })

  it('滚一格小时 → onChange 产出新的 HH:mm，分钟保持不变', async () => {
    const onChange = vi.fn()
    const { container, unmount } = render(
      <TimeWheelPicker
        value="21:00"
        onChange={onChange}
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const hourCol = columns(container)[0]
    // 初始定位在中间副本的 21（24 + 21 项）
    expect(offsetOf(hourCol)).toBe((24 + 21 - CENTER) * ROW)
    await notched(hourCol, 120)
    expect(onChange).toHaveBeenLastCalledWith('22:00')
    // 一格只走一行：位移恰好增加一个行高
    expect(offsetOf(hourCol)).toBe((24 + 22 - CENTER) * ROW)
    unmount()
  })

  it('分钟列从 59 继续往下 → 首尾循环回到 00，不产出非法时间', async () => {
    const onChange = vi.fn()
    const { container, unmount } = render(
      <TimeWheelPicker
        value="21:59"
        onChange={onChange}
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const minuteCol = columns(container)[1]
    await notched(minuteCol, 120)
    expect(onChange).toHaveBeenLastCalledWith('21:00')
    const calls = onChange.mock.calls.map((c) => c[0] as string)
    expect(calls.every((v) => /^\d{2}:\d{2}$/.test(v))).toBe(true)
    unmount()
  })

  it('键盘 ArrowDown / ArrowUp 步进一行并夹在合法范围内', async () => {
    const onChange = vi.fn()
    const { container, unmount } = render(
      <TimeWheelPicker
        value="23:59"
        onChange={onChange}
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const hourCol = columns(container)[0]
    await act(async () => {
      hourCol.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      await new Promise((r) => setTimeout(r, 260))
    })
    expect(onChange).toHaveBeenLastCalledWith('00:59')
    unmount()
  })

  it('Esc 收起展开态（焦点回到一行高度）', async () => {
    const { container, unmount } = render(
      <TimeWheelPicker
        value="21:00"
        onChange={vi.fn()}
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const root = container.querySelector('.tw') as HTMLElement
    await act(async () => {
      root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(root.classList.contains('is-open')).toBe(true)
    const hourCol = columns(container)[0]
    await act(async () => {
      hourCol.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await new Promise((r) => setTimeout(r, 200))
    })
    expect(root.classList.contains('is-open')).toBe(false)
    unmount()
  })

  it('展开是浮层：外层只留一个不可见的尺寸占位，展开不撑高布局', async () => {
    const { container, unmount } = render(
      <TimeWheelPicker
        value="21:00"
        onChange={vi.fn()}
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const root = container.querySelector('.tw') as HTMLElement
    // 浮层 + 尺寸占位：占位决定 .tw 的布局尺寸，浮层负责视觉（见 ui-misc.css）
    expect(container.querySelector('.tw-panel')).not.toBeNull()
    const sizer = container.querySelector('.tw-sizer') as HTMLElement
    expect(sizer).not.toBeNull()
    expect(sizer.getAttribute('aria-hidden')).toBe('true')
    // 展开只切 class，不写内联高度 —— 布局尺寸因此完全由占位决定，不会随展开变化
    await act(async () => {
      root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(root.classList.contains('is-open')).toBe(true)
    expect(root.style.height).toBe('')
    unmount()
  })

  it('未点击时滚轮不归控件（避免滑过时误改），点击后按指针所在列分派', async () => {
    const onChange = vi.fn()
    const { container, unmount } = render(
      <TimeWheelPicker
        value="21:30"
        onChange={onChange}
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const root = container.querySelector('.tw') as HTMLElement
    const minuteCol = columns(container)[1]
    const rect = root.getBoundingClientRect()
    const wheel = (dx: 'left' | 'right') =>
      new WheelEvent('wheel', {
        deltaY: 120,
        deltaMode: 0,
        bubbles: true,
        cancelable: true,
        clientX: dx === 'left' ? rect.left + 6 : rect.right - 6,
        clientY: rect.top + rect.height / 2
      })

    // 1) 没点过：滚轮完全不动值，也不展开
    await act(async () => {
      minuteCol.dispatchEvent(wheel('right'))
      await new Promise((r) => setTimeout(r, 120))
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(root.classList.contains('is-open')).toBe(false)

    // 2) 点一下展开
    await act(async () => {
      root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(root.classList.contains('is-open')).toBe(true)

    // 3) 展开后：右半边（分钟）滚一格 → 分钟 +1
    await act(async () => {
      minuteCol.dispatchEvent(wheel('right'))
      await new Promise((r) => setTimeout(r, 320))
    })
    expect(onChange).toHaveBeenLastCalledWith('21:31')
    unmount()
  })

  it('禁用态不可聚焦，语义标成 aria-disabled', () => {
    const { container, unmount } = render(
      <TimeWheelPicker
        value="21:00"
        onChange={vi.fn()}
        disabled
        ariaLabel="提醒时间"
        hourLabel="小时"
        minuteLabel="分钟"
      />
    )
    const [hourCol] = columns(container)
    expect(hourCol.tabIndex).toBe(-1)
    expect(hourCol.getAttribute('aria-disabled')).toBe('true')
    expect(container.querySelector('.tw.is-disabled')).not.toBeNull()
    unmount()
  })
})
