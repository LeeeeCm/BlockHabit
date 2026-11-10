import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  remove: vi.fn(),
  stat: vi.fn(),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: async () => 'C:/appdata',
  join: async (...parts: string[]) => parts.join('/'),
}))
vi.mock('@tauri-apps/plugin-opener', () => ({ openPath: vi.fn(), revealItemInDir: vi.fn() }))

import * as fsPlugin from '@tauri-apps/plugin-fs'
import * as opener from '@tauri-apps/plugin-opener'
import { createBackup, kindOfName, listBackups, openDataDir, parseStamp, readBackup } from './backups'

const readDir = vi.mocked(fsPlugin.readDir)
const readTextFile = vi.mocked(fsPlugin.readTextFile)
const writeTextFile = vi.mocked(fsPlugin.writeTextFile)
const remove = vi.mocked(fsPlugin.remove)
const stat = vi.mocked(fsPlugin.stat)
const revealItemInDir = vi.mocked(opener.revealItemInDir)

function entry(name: string) {
  return { name, isDirectory: false, isFile: true, isSymlink: false } as never
}

function archive(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: 2,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    ...extra,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // 模拟桌面环境：本模块用 __TAURI_INTERNALS__ 判定是否跑在 Tauri 里
  ;(globalThis as unknown as { window: unknown }).window = globalThis
  ;(globalThis as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  stat.mockResolvedValue({ size: 1234 } as never)
})

describe('backups · 文件名解析', () => {
  it('parseStamp 能从自动备份名解析出毫秒时间戳', () => {
    const ms = parseStamp('blockhabit-backup-2026-11-10T03-40-12-345Z.json', 'blockhabit-backup-')
    expect(ms).toBe(Date.UTC(2026, 10, 10, 3, 40, 12, 345))
  })

  it('parseStamp 对不合法名字返回 null', () => {
    expect(parseStamp('blockhabit.json', 'blockhabit-backup-')).toBeNull()
    expect(parseStamp('blockhabit-backup-oops.json', 'blockhabit-backup-')).toBeNull()
  })

  it('kindOfName 区分 auto / manual / corrupt', () => {
    expect(kindOfName('blockhabit-backup-2026-11-10T03-40-12-345Z.json')).toBe('auto')
    expect(kindOfName('blockhabit-manual-2026-11-10T03-40-12-345Z.json')).toBe('manual')
    expect(kindOfName('blockhabit.json.corrupt-backup')).toBe('corrupt')
    expect(kindOfName('blockhabit.json')).toBeNull()
  })
})

describe('backups · 列表', () => {
  it('只挑出备份文件，按时间从新到旧，corrupt 排最后', async () => {
    readDir.mockResolvedValue([
      entry('blockhabit.json'),
      entry('blockhabit-backup-2026-11-08T01-00-00-000Z.json'),
      entry('blockhabit-backup-2026-11-10T02-00-00-000Z.json'),
      entry('blockhabit-manual-2026-11-09T05-00-00-000Z.json'),
      entry('blockhabit.json.corrupt-backup'),
      entry('other-file.txt'),
    ] as never)
    const list = await listBackups()
    expect(list.map((b) => b.name)).toEqual([
      'blockhabit-backup-2026-11-10T02-00-00-000Z.json',
      'blockhabit-manual-2026-11-09T05-00-00-000Z.json',
      'blockhabit-backup-2026-11-08T01-00-00-000Z.json',
      'blockhabit.json.corrupt-backup',
    ])
    expect(list.map((b) => b.kind)).toEqual(['auto', 'manual', 'auto', 'corrupt'])
    expect(list.every((b) => b.size === 1234)).toBe(true)
  })

  it('stat 失败不影响列表（size 记 0）', async () => {
    readDir.mockResolvedValue([entry('blockhabit-backup-2026-11-10T02-00-00-000Z.json')] as never)
    stat.mockRejectedValue(new Error('io'))
    const list = await listBackups()
    expect(list).toHaveLength(1)
    expect(list[0].size).toBe(0)
  })

  it('读目录失败时返回空数组而不是抛错', async () => {
    readDir.mockRejectedValue(new Error('denied'))
    await expect(listBackups()).resolves.toEqual([])
  })
})

describe('backups · 读取与恢复', () => {
  it('readBackup 通过严格校验返回 AppState', async () => {
    readTextFile.mockResolvedValue(archive())
    const state = await readBackup('blockhabit-backup-2026-11-10T02-00-00-000Z.json')
    expect(state).not.toBeNull()
    expect(state?.activeBlueprintId).toBe('plant')
  })

  it('readBackup 拒绝损坏备份', async () => {
    readTextFile.mockResolvedValue('{ not json')
    expect(await readBackup('blockhabit-backup-x.json')).toBeNull()
  })

  it('readBackup 接受 v1 旧档并迁移', async () => {
    readTextFile.mockResolvedValue(
      JSON.stringify({
        schemaVersion: 1,
        habits: [{ id: 'h1', name: '读书', frequency: { type: 'daily' }, createdAt: '2026-01-01T00:00:00.000Z' }],
        checkIns: [],
        builds: [],
        activeBlueprintId: 'plant',
        completedBlueprintIds: [],
        settings: { theme: 'light', language: 'zh' },
        dayClaims: [],
      }),
    )
    const state = await readBackup('blockhabit-backup-2026-11-10T02-00-00-000Z.json')
    expect(state).not.toBeNull()
    expect(state?.schemaVersion).toBe(2)
  })
})

describe('backups · 创建与目录', () => {
  it('createBackup 写入 manual 前缀文件并保留最多 5 份', async () => {
    readDir.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => entry('blockhabit-manual-2026-11-0' + (i + 1) + 'T00-00-00-000Z.json')) as never,
    )
    const ok = await createBackup(JSON.parse(archive()))
    expect(ok).toBe(true)
    expect(writeTextFile).toHaveBeenCalledTimes(1)
    const writtenPath = String(writeTextFile.mock.calls[0][0])
    expect(writtenPath).toContain('blockhabit-manual-')
    // 目录里拿到 6 份旧快照（mock 不含刚写入的那份）→ 超过 5 份保留上限 → 删 1 份最旧
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('非桌面环境直接返回空/失败，不触达 FS', async () => {
    delete (globalThis as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    await expect(listBackups()).resolves.toEqual([])
    expect(await createBackup(JSON.parse(archive()))).toBe(false)
    expect(await openDataDir()).toBe(false)
    expect(readDir).not.toHaveBeenCalled()
  })

  it('openDataDir 用 revealItemInDir 定位数据目录（opener:default 内的权限）', async () => {
    revealItemInDir.mockResolvedValue(undefined as never)
    expect(await openDataDir()).toBe(true)
    expect(revealItemInDir).toHaveBeenCalledWith('C:/appdata')
  })
})
