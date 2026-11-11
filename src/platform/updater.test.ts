import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * D-20261111-069：updater 适配层单测。
 * 重点验证：默认构建（未设置 VITE_UPDATER_ENABLED）**不 import 插件、不发请求**；
 * 启用后 check 的四种结果映射；安装进度与错误脱敏；取消/重复检查的资源释放。
 */

const plugin = vi.hoisted(() => ({
  imported: false,
  check: vi.fn()
}))

vi.mock('@tauri-apps/plugin-updater', () => {
  plugin.imported = true
  return { check: plugin.check }
})

const processPlugin = vi.hoisted(() => ({ relaunch: vi.fn() }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: processPlugin.relaunch }))

type UpdaterModule = typeof import('./updater')

/** 重新加载适配层模块，清空模块级 pendingUpdate 状态 */
async function loadUpdater(): Promise<UpdaterModule> {
  vi.resetModules()
  return import('./updater')
}

function setTauriRuntime(present: boolean): void {
  if (present) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true })
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
}

function makeUpdate(overrides: { version?: string; body?: string } = {}) {
  const downloadAndInstall = vi.fn(async (onEvent?: (event: unknown) => void) => {
    onEvent?.({ event: 'Started', data: { contentLength: 12 } })
    onEvent?.({ event: 'Progress', data: { chunkLength: 12 } })
    onEvent?.({ event: 'Finished' })
  })
  const close = vi.fn(async () => {})
  return {
    version: overrides.version ?? '0.3.0',
    body: overrides.body,
    downloadAndInstall,
    close
  }
}

beforeEach(() => {
  plugin.imported = false
  plugin.check.mockReset()
  processPlugin.relaunch.mockReset().mockResolvedValue(undefined)
  setTauriRuntime(false)
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
  setTauriRuntime(false)
})

describe('updater：默认构建（未启用）', () => {
  it('不 import 插件、不发请求，checkForUpdate 返回 disabled', async () => {
    const updater = await loadUpdater()
    expect(updater.isUpdaterEnabled()).toBe(false)

    const result = await updater.checkForUpdate()

    expect(result).toEqual({ status: 'disabled' })
    expect(plugin.imported).toBe(false)
    expect(plugin.check).not.toHaveBeenCalled()
  })

  it('只设置 VITE_UPDATER_ENABLED 但不在 Tauri 内：仍禁用且不 import 插件', async () => {
    vi.stubEnv('VITE_UPDATER_ENABLED', '1')
    const updater = await loadUpdater()

    expect(updater.isUpdaterEnabled()).toBe(false)
    expect(await updater.checkForUpdate()).toEqual({ status: 'disabled' })
    expect(plugin.imported).toBe(false)
    expect(plugin.check).not.toHaveBeenCalled()
  })

  it('禁用时 installUpdate 返回 disabled（不 import 插件）', async () => {
    const updater = await loadUpdater()
    expect(await updater.installUpdate()).toEqual({ status: 'disabled' })
    expect(plugin.imported).toBe(false)
  })
})

describe('updater：启用后（VITE_UPDATER_ENABLED=1 且 Tauri 运行时）', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_UPDATER_ENABLED', '1')
    setTauriRuntime(true)
  })

  it('check 返回 null → latest + 检查时间', async () => {
    plugin.check.mockResolvedValue(null)
    const updater = await loadUpdater()

    const result = await updater.checkForUpdate()

    expect(plugin.imported).toBe(true)
    expect(plugin.check).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('latest')
    if (result.status === 'latest') expect(result.checkedAt).toBeInstanceOf(Date)
  })

  it('check 返回更新 → available(version, body)', async () => {
    plugin.check.mockResolvedValue(makeUpdate({ version: '0.3.0', body: 'Release notes' }))
    const updater = await loadUpdater()

    const result = await updater.checkForUpdate()

    expect(result).toEqual({ status: 'available', version: '0.3.0', body: 'Release notes' })
  })

  it('installUpdate 下载+安装，回传进度并重启（process 插件按需懒加载）', async () => {
    const update = makeUpdate()
    plugin.check.mockResolvedValue(update)
    const updater = await loadUpdater()
    await updater.checkForUpdate()
    const progress = vi.fn()

    const result = await updater.installUpdate(progress)

    expect(result).toEqual({ status: 'installed' })
    expect(update.downloadAndInstall).toHaveBeenCalledTimes(1)
    expect(progress).toHaveBeenCalled()
    const lastProgress = progress.mock.calls[progress.mock.calls.length - 1]?.[0]
    expect(lastProgress).toEqual({ downloadedBytes: 12, contentLength: 12 })
    expect(processPlugin.relaunch).toHaveBeenCalledTimes(1)
  })

  it('未检查就安装 → not-checked（不发起下载）', async () => {
    const updater = await loadUpdater()
    const result = await updater.installUpdate()
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.error.code).toBe('not-checked')
  })

  it('check 失败 → error，摘要单行脱敏，不伪装成已是最新', async () => {
    plugin.check.mockRejectedValue(new Error('endpoint unreachable\nretry later'))
    const updater = await loadUpdater()

    const result = await updater.checkForUpdate()

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.code).toBe('check-failed')
      expect(result.error.message).toBe('Error: endpoint unreachable retry later')
      expect(result.error.message).not.toContain('\n')
    }
  })

  it('再次检查会释放旧的 Update 句柄；丢弃后不能再安装', async () => {
    const first = makeUpdate()
    plugin.check.mockResolvedValueOnce(first).mockResolvedValueOnce(null)
    const updater = await loadUpdater()

    await updater.checkForUpdate()
    const second = await updater.checkForUpdate()

    expect(second.status).toBe('latest')
    expect(first.close).toHaveBeenCalledTimes(1)
    const install = await updater.installUpdate()
    expect(install.status).toBe('error')
    if (install.status === 'error') expect(install.error.code).toBe('not-checked')
  })

  it('discardPendingUpdate 释放句柄（取消/离开页面场景）', async () => {
    const update = makeUpdate()
    plugin.check.mockResolvedValue(update)
    const updater = await loadUpdater()

    await updater.checkForUpdate()
    await updater.discardPendingUpdate()

    expect(update.close).toHaveBeenCalledTimes(1)
    const install = await updater.installUpdate()
    expect(install.status).toBe('error')
  })
})
