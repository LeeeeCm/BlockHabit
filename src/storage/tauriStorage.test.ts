import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn()
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => 'C:/appdata',
  join: async (...parts: string[]) => parts.join('/')
}))

import * as fsPlugin from '@tauri-apps/plugin-fs'
import { createTauriStorageAdapter } from './tauriStorage'

const exists = vi.mocked(fsPlugin.exists)
const readTextFile = vi.mocked(fsPlugin.readTextFile)
const writeTextFile = vi.mocked(fsPlugin.writeTextFile)
const rename = vi.mocked(fsPlugin.rename)

const MAIN = 'C:/appdata/blockhabit.json'

function validArchive() {
  return JSON.stringify({
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' }
  })
}

function adapterState() {
  return JSON.parse(validArchive())
}

beforeEach(() => {
  vi.clearAllMocks()
  exists.mockResolvedValue(true)
  readTextFile.mockResolvedValue(validArchive())
  writeTextFile.mockResolvedValue(undefined)
  rename.mockResolvedValue(undefined)
})

describe('tauriStorage.load', () => {
  it('文件不存在 → 无存档，且不算读取失败', async () => {
    exists.mockResolvedValue(false)
    const res = await createTauriStorageAdapter().load()
    expect(res.state).toBeNull()
    expect(res.loadFailed).toBeFalsy()
  })

  it('文件存在但读取失败（被占用/权限）→ loadFailed，而不是"没有存档"', async () => {
    readTextFile.mockRejectedValue(new Error('EBUSY: resource busy'))
    const res = await createTauriStorageAdapter().load()
    expect(res.state).toBeNull()
    expect(res.loadFailed).toBe(true)
    expect(res.detail).toContain('EBUSY')
  })

  it('exists 自身抛错 → loadFailed', async () => {
    exists.mockRejectedValue(new Error('EACCES'))
    const res = await createTauriStorageAdapter().load()
    expect(res.loadFailed).toBe(true)
  })

  it('JSON 损坏 → 备份原文后返回无存档（不标记读取失败，但标记 corruptRecovered）', async () => {
    readTextFile.mockResolvedValue('{ not json')
    const res = await createTauriStorageAdapter().load()
    expect(res.state).toBeNull()
    expect(res.loadFailed).toBeFalsy()
    expect(res.corruptRecovered).toBe(true)
    expect(writeTextFile).toHaveBeenCalledWith(`${MAIN}.corrupt-backup`, '{ not json')
  })

  it('正常档 → 返回迁移后的状态', async () => {
    const res = await createTauriStorageAdapter().load()
    expect(res.state).not.toBeNull()
    expect(res.state?.activeBlueprintId).toBe('plant')
    expect(res.loadFailed).toBeFalsy()
  })
})

describe('tauriStorage.save', () => {
  it('先写唯一 tmp 再原子 rename', async () => {
    await createTauriStorageAdapter().save(adapterState())
    const written = writeTextFile.mock.calls.map((c) => c[0] as string)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatch(/blockhabit\.json\.\d+\.tmp$/)
    expect(rename).toHaveBeenCalledWith(written[0], MAIN)
  })

  it('并发写使用不同的 tmp 名，互不覆盖', async () => {
    const adapter = createTauriStorageAdapter()
    await adapter.save(adapterState())
    await adapter.save(adapterState())
    const written = writeTextFile.mock.calls.map((c) => c[0] as string)
    expect(written).toHaveLength(2)
    expect(written[0]).not.toBe(written[1])
  })

  it('rename 失败时抛出，且绝不回退直接覆盖主档', async () => {
    rename.mockRejectedValue(new Error('EPERM'))
    await expect(createTauriStorageAdapter().save(adapterState())).rejects.toThrow('EPERM')
    const written = writeTextFile.mock.calls.map((c) => c[0] as string)
    // 只有 tmp 写入，没有任何一次直写主档（非原子写会产生半截 JSON）
    expect(written.every((p) => p !== MAIN)).toBe(true)
  })
})
