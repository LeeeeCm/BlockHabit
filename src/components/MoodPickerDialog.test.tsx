import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOOD_NOTE_MAX, MOOD_PRESETS, MoodPickerDialog } from './MoodPickerDialog'
import { useAppStore } from '../store/appStore'
import { APPROVED_BLUEPRINT_COLORS } from '../logic/blueprints/palette'

/**
 * D-20261126-118：心境选择弹窗。
 * 锁定：8 个预设都在、点选即回调、自定义文本互斥且带长度上限、
 * 以及「清除心境」把两处都清空。
 */

vi.mock('../audio/sound', () => ({ playSnapSound: vi.fn() }))

function render(ui: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return {
    container: document.body,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    }
  }
}

function buttons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll('button')) as HTMLButtonElement[]
}

function byText(root: HTMLElement, text: string): HTMLButtonElement {
  const found = buttons(root).find((b) => (b.textContent ?? '').trim().includes(text))
  if (!found) throw new Error(`button not found: ${text}`)
  return found
}

beforeEach(() => {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'zh' }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MoodPickerDialog（D-20261126-118）', () => {
  it('渲染 8 个预设心境（原有 4 个 + 新增 4 个）', () => {
    const { unmount } = render(
      <MoodPickerDialog
        mood={undefined}
        moodNote={undefined}
        onClose={vi.fn()}
        onPickMood={vi.fn()}
        onPickNote={vi.fn()}
      />
    )
    expect(MOOD_PRESETS.length).toBe(8)
    const text = document.body.textContent ?? ''
    for (const label of ['充实', '硬啃', '灵感', '平静', '感恩', '专注', '疲惫', '自豪']) {
      expect(text).toContain(label)
    }
    unmount()
  })

  it('点某个预设 → onPickMood 拿到该值并关闭', () => {
    const onPickMood = vi.fn()
    const onClose = vi.fn()
    const { unmount } = render(
      <MoodPickerDialog
        mood={undefined}
        moodNote={undefined}
        onClose={onClose}
        onPickMood={onPickMood}
        onPickNote={vi.fn()}
      />
    )
    act(() => byText(document.body, '感恩').click())
    expect(onPickMood).toHaveBeenCalledWith('grateful')
    expect(onClose).toHaveBeenCalled()
    unmount()
  })

  it('自定义心境：写文本后保存 → onPickNote 拿到 trim 后的值', async () => {
    const onPickNote = vi.fn()
    const { unmount } = render(
      <MoodPickerDialog
        mood="calm"
        moodNote={undefined}
        onClose={vi.fn()}
        onPickMood={vi.fn()}
        onPickNote={onPickNote}
      />
    )
    const input = document.body.querySelector('input[type="text"]') as HTMLInputElement
    expect(input).not.toBeNull()
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      setValue?.call(input, '  有点累但撑住了  ')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => byText(document.body, '用这个').click())
    expect(onPickNote).toHaveBeenCalledWith('有点累但撑住了')
    unmount()
  })

  it('自定义文本超过上限时保存按钮禁用', async () => {
    const onPickNote = vi.fn()
    const { unmount } = render(
      <MoodPickerDialog
        mood={undefined}
        moodNote={undefined}
        onClose={vi.fn()}
        onPickMood={vi.fn()}
        onPickNote={onPickNote}
      />
    )
    const input = document.body.querySelector('input[type="text"]') as HTMLInputElement
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      setValue?.call(input, 'x'.repeat(MOOD_NOTE_MAX + 1))
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const save = byText(document.body, '用这个')
    expect(save.disabled).toBe(true)
    act(() => save.click())
    expect(onPickNote).not.toHaveBeenCalled()
    unmount()
  })

  it('清除心境：onPickNote 收到空串（调用方据此清空两处）', () => {
    const onPickNote = vi.fn()
    const { unmount } = render(
      <MoodPickerDialog
        mood="spark"
        moodNote={undefined}
        onClose={vi.fn()}
        onPickMood={vi.fn()}
        onPickNote={onPickNote}
      />
    )
    act(() => byText(document.body, '清除心境').click())
    expect(onPickNote).toHaveBeenCalledWith('')
    unmount()
  })

  it('新增心境图标不引入任何新色相（仅继承 currentColor）', () => {
    const { unmount } = render(
      <MoodPickerDialog
        mood={undefined}
        moodNote={undefined}
        onClose={vi.fn()}
        onPickMood={vi.fn()}
        onPickNote={vi.fn()}
      />
    )
    const svgs = Array.from(document.body.querySelectorAll('svg'))
    expect(svgs.length).toBeGreaterThanOrEqual(MOOD_PRESETS.length)
    for (const svg of svgs) {
      const fill = svg.getAttribute('fill')
      expect(fill === null || fill === 'none' || APPROVED_BLUEPRINT_COLORS.has(fill)).toBe(true)
    }
    unmount()
  })
})
