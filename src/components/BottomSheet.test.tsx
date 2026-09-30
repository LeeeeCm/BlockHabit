import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { BottomSheet, _resetSheetLockCountForTest } from './BottomSheet'
import * as platform from '../platform'
import * as detectModule from '../platform/detect'
import { HabitDialog } from './HabitDialog'
import { SettingsDialog } from './SettingsDialog'
import { ConfirmDialog } from './ConfirmDialog'
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
      act(() => {
        root.unmount()
      })
      container.remove()
    },
    rerender: (newUi: React.ReactElement) => {
      act(() => {
        root.render(newUi)
      })
    },
    getByTestId: (testId: string) => {
      const el = container.querySelector(`[data-testid="${testId}"]`)
      if (!el) throw new Error(`Element with data-testid="${testId}" not found`)
      return el as HTMLElement
    },
    queryByTestId: (testId: string) => container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null,
    getByText: (text: string) => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes(text)) {
          return node.parentElement as HTMLElement
        }
      }
      throw new Error(`Element with text "${text}" not found`)
    },
  }
}

describe('BottomSheet component', () => {
  let hapticSpy: MockInstance

  beforeEach(() => {
    vi.restoreAllMocks()
    hapticSpy = vi.spyOn(platform, 'triggerHaptic').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    _resetSheetLockCountForTest()
    document.body.style.overflow = ''
  })

  it('renders title and children with fixed position overlay when open', () => {
    const { container, getByText, unmount } = render(
      <BottomSheet open={true} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    expect(getByText('测试抽屉')).toBeDefined()
    expect(getByText('抽屉内容')).toBeDefined()
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).toBeDefined()
    expect(dialog.style.position).toBe('fixed')
    expect(dialog.style.zIndex).toBe('1000')
    // 回归保护：标题栏必须保留 display:flex（曾因误删导致关闭按钮被挤到标题下一行）
    const h3 = getByText('测试抽屉')
    const headerRow = h3.parentElement as HTMLElement
    expect(headerRow.style.display).toBe('flex')
    expect(h3.style.flexGrow).toBe('1')
    expect(h3.style.minWidth).toBe('0px')
    unmount()
  })

  it('does not render when open is false', () => {
    const { queryByTestId, unmount } = render(
      <BottomSheet open={false} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    expect(queryByTestId('bottom-sheet-backdrop')).toBeNull()
    unmount()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { getByTestId, unmount } = render(
      <BottomSheet open={true} onClose={onClose} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    const backdrop = getByTestId('bottom-sheet-backdrop')
    act(() => {
      backdrop.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <BottomSheet open={true} onClose={onClose} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    const { getByTestId, unmount } = render(
      <BottomSheet open={true} onClose={onClose} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    const closeBtn = getByTestId('bottom-sheet-close')
    act(() => {
      closeBtn.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('calls onClose when drag handle is clicked', () => {
    const onClose = vi.fn()
    const { getByTestId, unmount } = render(
      <BottomSheet open={true} onClose={onClose} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    const handle = getByTestId('bottom-sheet-handle')
    act(() => {
      handle.click()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('calls triggerHaptic("light") on open', () => {
    const { unmount } = render(
      <BottomSheet open={true} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    expect(hapticSpy).toHaveBeenCalledWith('light')
    unmount()
  })

  it('does not call triggerHaptic when open is false', () => {
    const { unmount } = render(
      <BottomSheet open={false} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    expect(hapticSpy).not.toHaveBeenCalled()
    unmount()
  })

  it('locks body scroll when open and restores on unmount/close', () => {
    document.body.style.overflow = ''
    const { rerender, unmount } = render(
      <BottomSheet open={true} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <BottomSheet open={false} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    expect(document.body.style.overflow).toBe('')

    rerender(
      <BottomSheet open={true} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('renders HabitDialog in BottomSheet when isMobile is true and in dialog when desktop', () => {
    const detectSpy = vi.spyOn(detectModule, 'detectPlatform').mockReturnValue('mobile')
    const { queryByTestId, unmount } = render(<HabitDialog onClose={vi.fn()} />)
    expect(queryByTestId('bottom-sheet-handle')).not.toBeNull()
    unmount()

    detectSpy.mockReturnValue('desktop')
    const { queryByTestId: queryDesktop, unmount: unmountDesktop } = render(<HabitDialog onClose={vi.fn()} />)
    expect(queryDesktop('bottom-sheet-handle')).toBeNull()
    unmountDesktop()
  })

  it('renders SettingsDialog in BottomSheet when isMobile is true and in dialog when desktop', () => {
    const detectSpy = vi.spyOn(detectModule, 'detectPlatform').mockReturnValue('mobile')
    const { queryByTestId, unmount } = render(<SettingsDialog onClose={vi.fn()} />)
    expect(queryByTestId('bottom-sheet-handle')).not.toBeNull()
    unmount()

    detectSpy.mockReturnValue('desktop')
    const { queryByTestId: queryDesktop, unmount: unmountDesktop } = render(<SettingsDialog onClose={vi.fn()} />)
    expect(queryDesktop('bottom-sheet-handle')).toBeNull()
    unmountDesktop()
  })

  it('renders ConfirmDialog in BottomSheet when isMobile is true and in dialog when desktop', () => {
    const detectSpy = vi.spyOn(detectModule, 'detectPlatform').mockReturnValue('mobile')
    const { queryByTestId, unmount } = render(
      <ConfirmDialog title="确认删除" message="此操作不可逆" onCancel={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(queryByTestId('bottom-sheet-handle')).not.toBeNull()
    unmount()

    detectSpy.mockReturnValue('desktop')
    const { queryByTestId: queryDesktop, unmount: unmountDesktop } = render(
      <ConfirmDialog title="确认删除" message="此操作不可逆" onCancel={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(queryDesktop('bottom-sheet-handle')).toBeNull()
    unmountDesktop()
  })
  it('triggers onClose and light haptic when dragged down beyond 75px threshold', () => {
    const onClose = vi.fn()
    const { getByTestId, unmount } = render(
      <BottomSheet open={true} onClose={onClose} title="手势测试">
        <div>手势测试内容</div>
      </BottomSheet>
    )
    const handle = getByTestId('bottom-sheet-handle')

    function dispatchTouch(el: HTMLElement, eventType: string, clientY?: number) {
      const evt = new Event(eventType, { bubbles: true })
      if (clientY !== undefined) {
        Object.defineProperty(evt, 'touches', {
          configurable: true,
          value: [{ clientY }],
        })
      }
      el.dispatchEvent(evt)
    }

    // 下拉未达 75px 阈值（仅移动 30px）
    act(() => {
      dispatchTouch(handle, 'touchstart', 100)
      dispatchTouch(handle, 'touchmove', 130)
      dispatchTouch(handle, 'touchend')
    })
    expect(onClose).not.toHaveBeenCalled()

    // 下拉超过 75px 阈值（移动 100px）触发关闭与触感
    act(() => {
      dispatchTouch(handle, 'touchstart', 100)
      dispatchTouch(handle, 'touchmove', 200)
      dispatchTouch(handle, 'touchend')
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(hapticSpy).toHaveBeenCalledWith('light')

    unmount()
  })
})
