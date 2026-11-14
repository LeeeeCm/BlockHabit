import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncProvider, useSyncController } from './SyncProvider'
import { saveWebDavConfig } from './useSync'
import type { WebDavConfig } from './types'

/**
 * D-20261115-074 的回归测试：自动同步必须由应用级 Provider 驱动，
 * **不依赖 SettingsDialog 是否挂载**。
 *
 * 背景 bug：`useSync()` 原本只在 `SettingsDialog` 里调用，而 `App.tsx` 是
 * `{settingsOpen && <SettingsDialog/>}` —— 不开设置页，启动同步/定时同步/
 * keyring 迁移三组 effect 一次都不会跑。本文件用「只渲染 Provider、不渲染设置页」
 * 的方式把这个回归钉住。
 */

const cred = vi.hoisted(() => ({
  ready: false,
  account: vi.fn(async () => 'acct-hash'),
  get: vi.fn(async () => null as string | null),
  set: vi.fn(async () => true),
  remove: vi.fn(async () => true),
  probe: vi.fn(async () => false)
}))

vi.mock('../platform/credentials', () => ({
  isOsCredentialStoreReady: () => cred.ready,
  credentialStoreState: () => (cred.ready ? 'available' : 'unavailable'),
  credentialAccount: cred.account,
  getCredential: cred.get,
  setCredential: cred.set,
  removeCredential: cred.remove,
  probeCredentialStore: cred.probe,
  __resetCredentialStoreForTests: () => {}
}))

const remote = vi.hoisted(() => ({
  fetch: vi.fn(),
  push: vi.fn()
}))

vi.mock('./webdav', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./webdav')>()
  return { ...actual, fetchRemoteState: remote.fetch, pushRemoteState: remote.push }
})

// 启动同步要等 persistenceReady：真实实现要等 initPersistence，单测里直接给已 resolve 的
vi.mock('../store/appStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/appStore')>()
  return { ...actual, persistenceReady: Promise.resolve() }
})

const { useAppStore } = await import('../store/appStore')

function enabledConfig(overrides: Partial<WebDavConfig> = {}): WebDavConfig {
  return {
    endpoint: 'https://dav.test/webdav',
    username: 'alice',
    password: 'secret',
    enabled: true,
    autoSyncIntervalMinutes: 15,
    lastSyncAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 小时前 → 已过期，应触发启动同步
    lastSyncStatus: 'idle',
    lastSyncError: null,
    rememberPassword: true,
    ...overrides
  }
}

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function renderProvider() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(
      React.createElement(
        SyncProvider,
        null,
        React.createElement('div', { 'data-testid': 'child' }, 'no-settings-mount')
      )
    )
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  cred.ready = false
  cred.probe.mockResolvedValue(false)
  remote.fetch.mockReset().mockResolvedValue({ json: null, etag: null })
  remote.push.mockReset().mockResolvedValue(undefined)
  // syncNow 的前置门：存档已水合、未触发 needsUpgrade
  useAppStore.setState({ hydrated: true, needsUpgrade: false })
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  container?.remove()
  container = null
  root = null
  vi.useRealTimers()
  vi.clearAllTimers()
})

describe('SyncProvider：应用级自动同步（D-20261115-074）', () => {
  it('只挂 Provider、不挂 SettingsDialog 也会触发启动同步（回归）', async () => {
    saveWebDavConfig(enabledConfig())
    renderProvider()

    // 启动同步：persistenceReady → 判过期 → 等 2s → syncNow()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100)
    })

    expect(remote.fetch).toHaveBeenCalledTimes(1)
    expect(remote.push).toHaveBeenCalledTimes(1)
  })

  it('到点也会由定时器触发（不依赖组件重新挂载）', async () => {
    // lastSyncAt = 现在 → 启动同步跳过；只验证 15 分钟的定时器
    saveWebDavConfig(enabledConfig({ lastSyncAt: new Date().toISOString() }))
    renderProvider()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100)
    })
    expect(remote.fetch).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1000)
    })
    expect(remote.fetch).toHaveBeenCalledTimes(1)
  })

  it('未启用同步时不会发起任何请求', async () => {
    saveWebDavConfig(enabledConfig({ enabled: false }))
    renderProvider()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20 * 60 * 1000)
    })
    expect(remote.fetch).not.toHaveBeenCalled()
  })
})

describe('SyncProvider：消费者契约', () => {
  it('在 Provider 外调用 useSyncController 会抛错（防止 hook 被塞回弹窗）', () => {
    function Outside() {
      useSyncController()
      return null
    }
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      act(() => {
        root?.render(React.createElement(Outside))
      })
    }).toThrow(/SyncProvider/)
    spy.mockRestore()
  })
})
