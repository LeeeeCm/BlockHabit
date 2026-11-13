import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebdavPanel, type SyncController } from './WebdavPanel'
import { DEFAULT_WEBDAV_CONFIG, type WebDavConfig } from '../sync/types'
import { useAppStore } from '../store/appStore'
import { zh } from '../i18n/locales/zh'

/**
 * B1：A3 WebDAV 收尾。
 * - 已保存密码绝不回填 input.value（密码 DOM 缓解）；
 * - rememberPassword 开关接到 updateConfig；
 * - 自检支持取消（AbortController），取消结果如实提示，不误报失败。
 */

vi.mock('../platform/http', () => ({
  isTauriRuntime: () => true,
  httpFetch: (_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'))
      if (init?.signal?.aborted) return abort()
      init?.signal?.addEventListener('abort', abort, { once: true })
    })
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

function makeSync(overrides: Partial<WebDavConfig> = {}): {
  sync: SyncController
  updateConfig: ReturnType<typeof vi.fn>
} {
  const updateConfig = vi.fn()
  const sync: SyncController = {
    config: {
      ...DEFAULT_WEBDAV_CONFIG,
      endpoint: 'https://dav.example.com/dav/',
      username: 'alice',
      password: 'saved-secret',
      ...overrides
    },
    updateConfig,
    isSyncing: false,
    status: 'idle',
    error: null,
    lastSyncAt: null,
    syncNow: async () => true,
    getLastError: () => null
  }
  return { sync, updateConfig }
}

function renderPanel(sync: SyncController, onToast = vi.fn()): HTMLDivElement {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'zh' } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<WebdavPanel sync={sync} onToast={onToast} />)
  })
  return container
}

function buttonByText(rootEl: HTMLElement, text: string): HTMLButtonElement {
  const found = Array.from(rootEl.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes(text)
  )
  if (!found) throw new Error('button not found: ' + text)
  return found as HTMLButtonElement
}

async function tick(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

beforeEach(() => {
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, language: 'zh' } })
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  container?.remove()
  root = null
  container = null
})

describe('WebdavPanel：B1 密码与开关', () => {
  it('已保存密码不回填 input.value，只给 placeholder/hint', () => {
    const { sync } = makeSync({ password: 'saved-secret' })
    const el = renderPanel(sync)
    const input = el.querySelector('input[type="password"]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('')
    expect(input.getAttribute('autocomplete')).toBe('new-password')
    expect(input.getAttribute('placeholder')).toBe(zh.settings.webdav.passwordStoredPlaceholder)
    expect(el.textContent).toContain(zh.settings.webdav.passwordKeepHint)
    // 已保存密码不落进任何 DOM 文本
    expect(el.textContent).not.toContain('saved-secret')
  })

  it('无已保存密码时 placeholder 为普通提示；输入新密码写回 updateConfig', () => {
    const { sync, updateConfig } = makeSync({ password: '' })
    const el = renderPanel(sync)
    const input = el.querySelector('input[type="password"]') as HTMLInputElement
    expect(input.getAttribute('placeholder')).toBe(zh.settings.webdav.passwordPlaceholder)

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, 'typed-new-secret')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(updateConfig).toHaveBeenCalledWith({ password: 'typed-new-secret' })
  })

  it('rememberPassword 开关接到 updateConfig（默认记住 → 不记住）', () => {
    const { sync, updateConfig } = makeSync()
    const el = renderPanel(sync)
    act(() => {
      buttonByText(el, zh.settings.webdav.rememberPasswordOff).click()
    })
    expect(updateConfig).toHaveBeenCalledWith({ rememberPassword: false })
  })

  it('自检可取消：测试按钮变为取消，取消后提示已取消且不显示失败', async () => {
    const { sync } = makeSync()
    const onToast = vi.fn()
    const el = renderPanel(sync, onToast)

    act(() => {
      buttonByText(el, zh.settings.webdav.testButton).click()
    })
    await tick(10)
    const cancelBtn = buttonByText(el, zh.settings.webdav.cancelTest)
    expect(cancelBtn).toBeTruthy()

    act(() => {
      cancelBtn.click()
    })
    await tick(30)

    const messages = onToast.mock.calls.map((call) => call[0])
    expect(messages).toContain(zh.settings.webdav.testCancelled)
    expect(messages).not.toContain(zh.settings.webdav.testFail)
    // 取消后不会留下「测试中」状态
    expect(el.textContent).not.toContain(zh.settings.webdav.cancelTest)
  })
})
