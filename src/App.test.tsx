import type * as AppStoreModule from './store/appStore'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAppStore } from './store/appStore'

/** 让出一轮宏任务：兼容异步副作用与水合门后的渲染提交 */
const flushLazy = () => new Promise((resolve) => setTimeout(resolve, 0))

// Mock pages to lightweight markers
vi.mock('./pages/Today', () => ({
  default: () => <div data-testid="page-today">Today Page</div>
}))
vi.mock('./pages/Build', () => ({
  default: () => <div data-testid="page-build">Build Page</div>
}))
vi.mock('./pages/Showcase', () => ({
  default: () => <div data-testid="page-showcase">Showcase Page</div>
}))
vi.mock('./pages/Stats', () => ({
  default: () => <div data-testid="page-stats">Stats Page</div>
}))

// Mock storage & persistence to avoid running real singleton/fs
vi.mock('./store/appStore', async (importOriginal) => {
  const actual = await importOriginal<typeof AppStoreModule>()
  return {
    ...actual,
    initPersistence: vi.fn()
  }
})

// Mock tauri APIs
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    outerSize: vi.fn().mockResolvedValue({ width: 1100, height: 760 }),
    setSize: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    onResized: vi.fn().mockResolvedValue(() => {})
  }),
  LogicalSize: class {
    constructor(
      public width: number,
      public height: number
    ) {}
  }
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn()
}))

import App from './App'

describe('App keyboard shortcuts and modal guard', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    // D-20261110-056 水合门：测试直接给已水合状态（initPersistence 在此被 mock）
    useAppStore.setState({ hydrated: true })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (q: string) => ({
        matches: false,
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    })
  })

  afterEach(() => {
    if (container.parentElement) {
      document.body.removeChild(container)
    }
    document.querySelectorAll('[role="dialog"]').forEach((el) => el.remove())
  })

  it('switches tabs with number keys 1-4 when no dialog is open', async () => {
    const root = createRoot(container)
    await act(async () => {
      root.render(<App />)
      await flushLazy()
    })

    // Default tab is today
    expect(container.querySelector('[data-testid="page-today"]')).not.toBeNull()

    // Press '2' -> switches to build
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
      await flushLazy()
    })
    expect(container.querySelector('[data-testid="page-build"]')).not.toBeNull()

    // Press '4' -> switches to stats
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }))
      await flushLazy()
    })
    expect(container.querySelector('[data-testid="page-stats"]')).not.toBeNull()

    act(() => {
      root.unmount()
    })
  })

  it('blocks number key tab switching when a modal dialog is open', async () => {
    const root = createRoot(container)
    await act(async () => {
      root.render(<App />)
      await flushLazy()
    })

    // Starts at today
    expect(container.querySelector('[data-testid="page-today"]')).not.toBeNull()

    // Simulate an open modal dialog in the DOM
    const dialogEl = document.createElement('div')
    dialogEl.setAttribute('role', 'dialog')
    dialogEl.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialogEl)

    // Press '2' while modal is open -> should NOT switch to build
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
      await flushLazy()
    })
    expect(container.querySelector('[data-testid="page-today"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="page-build"]')).toBeNull()

    // Close/remove the dialog
    document.body.removeChild(dialogEl)

    // Press '2' now -> should switch to build
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
      await flushLazy()
    })
    expect(container.querySelector('[data-testid="page-build"]')).not.toBeNull()

    act(() => {
      root.unmount()
    })
  })

  it('renders only a hydration shell before the store is hydrated', () => {
    useAppStore.setState({ hydrated: false })
    const root = createRoot(container)
    act(() => {
      root.render(<App />)
    })
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="page-today"]')).toBeNull()
    act(() => {
      root.unmount()
    })
  })

  it('ignores number keys when typed inside form inputs', () => {
    const root = createRoot(container)
    act(() => {
      root.render(<App />)
    })

    const input = document.createElement('input')
    container.appendChild(input)
    input.focus()

    // Dispatch event with target as input
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }))
    })
    expect(container.querySelector('[data-testid="page-today"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="page-showcase"]')).toBeNull()

    act(() => {
      root.unmount()
    })
  })
})
