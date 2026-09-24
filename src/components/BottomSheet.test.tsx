import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { BottomSheet } from './BottomSheet'
import * as platform from '../platform'
import * as detectModule from '../platform/detect'
import { HabitDialog } from './HabitDialog'
import { SettingsDialog } from './SettingsDialog'

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
    document.body.style.overflow = ''
  })

  it('renders title and children when open', () => {
    const { getByText, unmount } = render(
      <BottomSheet open={true} onClose={vi.fn()} title="测试抽屉">
        <div>抽屉内容</div>
      </BottomSheet>
    )
    expect(getByText('测试抽屉')).toBeDefined()
    expect(getByText('抽屉内容')).toBeDefined()
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
})
