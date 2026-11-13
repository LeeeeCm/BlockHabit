import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebDavConfig } from './types'

/**
 * C4 §4 方案 B：WebDAV 密码交给 OS 凭据管理器（Windows Credential Manager）。
 *
 * 这里把 platform/credentials 整体 mock，用一个 ready 开关模拟三种环境：
 * 浏览器预览（不可用）、桌面端可用、桌面端在迁移时失败。
 * 验收重点是 C4 的迁移/回退约定：
 *   - rememberPassword=false 时磁盘与凭据管理器都不留密码（不破坏 B1 的假安全修复）；
 *   - 老存档明文 → 迁移成功后立刻清掉 localStorage 明文；
 *   - 迁移失败保持原样，下次启动重试，不破坏可用性；
 *   - credentialStore='os' 时重开能从凭据管理器回填密码；
 *   - 存储不可用时完全退回旧行为（明文随配置落盘），不引入无法同步的回归。
 */

const cred = vi.hoisted(() => ({
  ready: false,
  account: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  probe: vi.fn(),
}))

vi.mock('../platform/credentials', () => ({
  isOsCredentialStoreReady: () => cred.ready,
  credentialStoreState: () => (cred.ready ? 'available' : 'unavailable'),
  credentialAccount: cred.account,
  getCredential: cred.get,
  setCredential: cred.set,
  removeCredential: cred.remove,
  probeCredentialStore: cred.probe,
  __resetCredentialStoreForTests: () => {},
}))

const KEY = 'blockhabit_webdav_config'

function rawConfig(overrides: Partial<WebDavConfig> = {}): WebDavConfig {
  return {
    endpoint: 'https://dav.example.com/remote.php/dav',
    username: 'lee',
    password: 'secret-pass',
    enabled: true,
    autoSyncIntervalMinutes: 30,
    lastSyncAt: null,
    lastSyncStatus: 'idle',
    lastSyncError: null,
    rememberPassword: true,
    ...overrides,
  }
}

/** 等待 saveWebDavConfig 里 fire-and-forget 的凭据写入跑完 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

let useSyncModule: typeof import('./useSync')

beforeEach(async () => {
  localStorage.clear()
  cred.ready = false
  cred.account.mockReset().mockResolvedValue('acct-hash')
  cred.get.mockReset().mockResolvedValue(null)
  cred.set.mockReset().mockResolvedValue(true)
  cred.remove.mockReset().mockResolvedValue(true)
  cred.probe.mockReset().mockResolvedValue(false)
  vi.resetModules()
  useSyncModule = await import('./useSync')
})

afterEach(() => {
  localStorage.clear()
})

describe('C4 §4 方案 B：OS 凭据管理器接管 WebDAV 密码', () => {
  it('存储不可用：完全退回旧行为，密码仍随配置落盘（浏览器预览不被破坏）', () => {
    const { persistableWebDavConfig, saveWebDavConfig } = useSyncModule
    const config = rawConfig()
    expect(persistableWebDavConfig(config).password).toBe('secret-pass')
    expect(persistableWebDavConfig(config).credentialStore).toBeUndefined()

    saveWebDavConfig(config)
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    expect(stored.password).toBe('secret-pass')
    expect(stored.credentialStore).toBeUndefined()
  })

  it('存储可用：密码不再落 localStorage，只留 credentialStore=os 标记', () => {
    cred.ready = true
    const { persistableWebDavConfig } = useSyncModule
    const persisted = persistableWebDavConfig(rawConfig())
    expect(persisted.password).toBe('')
    expect(persisted.credentialStore).toBe('os')
  })

  it('rememberPassword=false：磁盘与凭据管理器都不留密码（存储可用时）', async () => {
    cred.ready = true
    const { saveWebDavConfig } = useSyncModule
    saveWebDavConfig(rawConfig({ rememberPassword: false }))
    await flushMicrotasks()

    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    expect(stored.password).toBe('')
    expect(stored.credentialStore).toBeUndefined()
    expect(cred.set).not.toHaveBeenCalled()
    expect(cred.remove).toHaveBeenCalledWith('acct-hash')
  })

  it('保存时把密码写进凭据管理器（存储可用、rememberPassword=true）', async () => {
    cred.ready = true
    const { saveWebDavConfig } = useSyncModule
    saveWebDavConfig(rawConfig())
    await flushMicrotasks()
    expect(cred.set).toHaveBeenCalledWith('acct-hash', 'secret-pass')
    // 磁盘上只有配置，没有密码
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}').password).toBe('')
  })

  it('迁移：老存档明文密码搬进凭据管理器后立刻清掉本地明文', async () => {
    cred.ready = true
    cred.probe.mockResolvedValue(true)
    const { hydrateWebDavCredentials } = useSyncModule

    const migrated = await hydrateWebDavCredentials(rawConfig())

    expect(cred.set).toHaveBeenCalledWith('acct-hash', 'secret-pass')
    expect(migrated.credentialStore).toBe('os')
    // 返回内存态仍持有密码（本次会话可以继续同步）
    expect(migrated.password).toBe('secret-pass')
    // 磁盘上已经清空
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    expect(stored.password).toBe('')
    expect(stored.credentialStore).toBe('os')
  })

  it('迁移失败：保持原样，不动本地明文（宁可下次重试，也不谎报已迁移）', async () => {
    cred.ready = true
    cred.probe.mockResolvedValue(true)
    cred.set.mockResolvedValue(false)
    const { hydrateWebDavCredentials } = useSyncModule

    const same = await hydrateWebDavCredentials(rawConfig())

    expect(same.credentialStore).toBeUndefined()
    expect(same.password).toBe('secret-pass')
    // 没有把标记写进磁盘，下次启动还会再试
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('回填：credentialStore=os 时从凭据管理器取回密码（重开仍能自动同步）', async () => {
    cred.ready = true
    cred.probe.mockResolvedValue(true)
    cred.get.mockResolvedValue('secret-pass')
    const { hydrateWebDavCredentials } = useSyncModule

    const hydrated = await hydrateWebDavCredentials(
      rawConfig({ password: '', credentialStore: 'os' })
    )

    expect(cred.account).toHaveBeenCalledWith(
      'https://dav.example.com/remote.php/dav',
      'lee'
    )
    expect(hydrated.password).toBe('secret-pass')
  })

  it('回填失败：密码留空，提示重输而不是把错误伪装成「已记住」', async () => {
    cred.ready = true
    cred.probe.mockResolvedValue(true)
    cred.get.mockResolvedValue(null)
    const { hydrateWebDavCredentials } = useSyncModule

    const hydrated = await hydrateWebDavCredentials(
      rawConfig({ password: '', credentialStore: 'os' })
    )

    expect(hydrated.password).toBe('')
  })

  it('关闭「记住密码」后启动：清掉凭据管理器里的旧密码', async () => {
    cred.ready = true
    cred.probe.mockResolvedValue(true)
    const { hydrateWebDavCredentials } = useSyncModule

    const cleared = await hydrateWebDavCredentials(
      rawConfig({ rememberPassword: false, credentialStore: 'os', password: '' })
    )

    expect(cred.remove).toHaveBeenCalledWith('acct-hash')
    expect(cleared.credentialStore).toBeUndefined()
    expect(cleared.password).toBe('')
  })

  it('存储不可用时迁移完全不执行（不误删明文，也不产生标记）', async () => {
    cred.ready = false
    cred.probe.mockResolvedValue(false)
    const { hydrateWebDavCredentials } = useSyncModule

    const same = await hydrateWebDavCredentials(rawConfig())

    expect(cred.set).not.toHaveBeenCalled()
    expect(cred.remove).not.toHaveBeenCalled()
    expect(same.password).toBe('secret-pass')
    expect(same.credentialStore).toBeUndefined()
  })
})
