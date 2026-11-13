import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { translations } from '../i18n'
import { useAppStore } from '../store/appStore'
import { clearCrashLog, getCrashLog } from '../platform/errorLog'

/** 渲染期必然抛错的子组件，用于触发 ErrorBoundary */
function Boom(): ReactElement {
  throw new Error('render exploded')
}

describe('ErrorBoundary 崩溃兜底', () => {
  const mounted: Array<{ root: Root; container: HTMLDivElement }> = []
  let reloadMock: ReturnType<typeof vi.fn>
  let originalLocationDescriptor: PropertyDescriptor | undefined

  function render(ui: ReactElement): HTMLDivElement {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mounted.push({ root, container })
    act(() => {
      root.render(ui)
    })
    return container
  }

  function query(container: HTMLDivElement, testId: string): HTMLElement {
    const element = container.querySelector(`[data-testid="${testId}"]`)
    if (!(element instanceof HTMLElement)) throw new Error(`missing [data-testid="${testId}"]`)
    return element
  }

  beforeEach(() => {
    clearCrashLog()
    useAppStore.setState((state) => ({ settings: { ...state.settings, language: 'zh' } }))
    // React 会向 console.error 打印被边界捕获的异常，测试里静音
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // jsdom 29 的 Location.reload 是不可配置不可写的自身属性，无法直接 spy；
    // 但 vitest 的 jsdom 环境把 window 暴露为可重定义的 global 代理，
    // 因此这里替换整个 location 对象来 mock reload（afterEach 原样还原）。
    reloadMock = vi.fn()
    originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { reload: reloadMock }
    })
  })

  afterEach(() => {
    while (mounted.length > 0) {
      const item = mounted.pop()
      if (!item) break
      act(() => {
        item.root.unmount()
      })
      item.container.remove()
    }

    if (originalLocationDescriptor) {
      Object.defineProperty(window, 'location', originalLocationDescriptor)
    }

    vi.restoreAllMocks()
    clearCrashLog()
  })

  it('renders the fallback card when a child throws during render', () => {
    const container = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    expect(container.querySelector('[data-testid="error-boundary"]')).not.toBeNull()
    expect(container.textContent).toContain(translations.zh.errorBoundary.title)
    expect(container.textContent).toContain(translations.zh.errorBoundary.body)

    const reloadButton = query(container, 'error-boundary-reload')
    const exportButton = query(container, 'error-boundary-export')
    expect(reloadButton.textContent).toBe(translations.zh.errorBoundary.reload)
    expect(exportButton.textContent).toBe(translations.zh.errorBoundary.export)

    // 复用既有按钮类名与既有胶囊圆角令牌：不新增颜色 / 阴影 / 圆角档位
    expect(reloadButton.className).toContain('btn')
    expect(reloadButton.className).toContain('primary')
    expect(exportButton.className).toContain('btn')
    expect(exportButton.className).toContain('ghost')
    expect(reloadButton.style.borderRadius).toBe('var(--r-pill)')
    expect(exportButton.style.borderRadius).toBe('var(--r-pill)')
  })

  it('reloads the page when the reload button is clicked', () => {
    const container = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    act(() => {
      query(container, 'error-boundary-reload').click()
    })

    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('writes the caught render error into the local crash log', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )

    const renderEntry = getCrashLog().find((entry) => entry.kind === 'render')
    expect(renderEntry).toBeDefined()
    expect(renderEntry?.message).toBe('render exploded')
  })

  it('renders the compact transparent fallback for the tray variant', () => {
    const container = render(
      <ErrorBoundary variant="tray">
        <Boom />
      </ErrorBoundary>
    )

    const fallback = query(container, 'error-boundary')
    expect(fallback.dataset.variant).toBe('tray')
    // 托盘是透明窗口：兜底卡片自己撑起 surface，不额外铺底色
    expect(fallback.style.background).toBe('transparent')
    expect(container.textContent).toContain(translations.zh.errorBoundary.title)
    expect(query(container, 'error-boundary-reload').textContent).toBe(
      translations.zh.errorBoundary.reload
    )
  })

  it('exports diagnostics locally from the fallback card', () => {
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:blockhabit-diagnostics')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL
    })
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    try {
      const container = render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      )

      act(() => {
        query(container, 'error-boundary-export').click()
      })

      expect(createObjectURL).toHaveBeenCalledTimes(1)
      const blob = createObjectURL.mock.calls[0][0]
      expect(blob.size).toBeGreaterThan(0)
      expect(anchorClick).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL
      })
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL
      })
    }
  })
})
