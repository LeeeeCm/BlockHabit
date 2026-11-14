/**
 * A4 档案包导出编排（自 archive.test.ts 拆分，D-20261110-062）：
 * 桌面端文件夹导出 / 浏览器 ZIP / downloadBlobFile / 离屏建筑图渲染。
 */

import { describe, expect, it } from 'vitest'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { prepareImport } from './adapter'
import {
  ARCHIVE_FOLDER_PREFIX,
  ARCHIVE_FORMAT_VERSION,
  ARCHIVE_TMP_PREFIX,
  downloadBlobFile,
  isArchiveExporting,
  runArchiveExport,
  utf8Decode
} from './archive'
import { ARCHIVE_BUILDING_SIZE, renderBuildingPng } from '../render/archiveCanvas'
import {
  archiveState,
  createMockFs,
  entryBytes,
  FAKE_PNG,
  parseZip,
  plantBlocks
} from './archiveTestUtils'

/* ---------------- 导出编排 ---------------- */

describe('runArchiveExport（桌面端文件夹）', () => {
  async function runDesktop(
    mock = createMockFs(),
    overrides: Partial<Parameters<typeof runArchiveExport>[0]> = {}
  ) {
    const { state, stateJson } = archiveState({ builds: plantBlocks() })
    const progress: Array<{ phase: string; done: number; total: number }> = []
    const result = await runArchiveExport({
      state,
      stateJson,
      appVersion: '0.2.0',
      platform: 'desktop',
      lang: 'zh',
      renderBuilding: async () => FAKE_PNG,
      fs: mock.fs,
      onProgress: (value) => progress.push(value),
      now: new Date(Date.UTC(2026, 10, 10, 12, 0, 0)),
      ...overrides
    })
    return { result, progress, mock }
  }

  it('写 tmp → 全部文件 → rename → reveal，产物在 exports 下', async () => {
    const { result, progress, mock } = await runDesktop()
    expect(result.ok).toBe(true)
    if (!result.ok || result.mode !== 'desktop') throw new Error('desktop export failed')
    expect(result.dir).toContain(ARCHIVE_FOLDER_PREFIX)
    expect(result.dir).not.toContain(ARCHIVE_TMP_PREFIX)
    expect(result.readmePath.endsWith('README.md')).toBe(true)
    expect(result.files).toBeGreaterThanOrEqual(5)
    expect(result.bytes).toBeGreaterThan(0)
    const renameCall = mock.calls.find((call) => call.startsWith('rename:'))
    expect(renameCall).toBeDefined()
    expect(renameCall).toContain(ARCHIVE_TMP_PREFIX)
    expect(renameCall!.split('->')[1]).toContain(ARCHIVE_FOLDER_PREFIX)
    expect(mock.calls.some((call) => call.startsWith('reveal:'))).toBe(true)
    expect(progress.some((item) => item.phase === 'render')).toBe(true)
    expect(progress.some((item) => item.phase === 'checksum')).toBe(true)
    expect(progress.some((item) => item.phase === 'write')).toBe(true)
    expect(mock.calls).toContain('appDataDir')
  })

  it('写入失败：清理 tmp、不 rename、返回失败（无半成品）', async () => {
    const mock = createMockFs({ failWriteAt: 2 })
    const { result } = await runDesktop(mock)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.cancelled).toBe(false)
    expect(result.error).toContain('disk full')
    expect(mock.calls.some((call) => call.startsWith('remove:'))).toBe(true)
    expect(mock.calls.some((call) => call.startsWith('rename:'))).toBe(false)
  })

  it('取消：渲染阶段 abort → 不写盘、清理并返回 cancelled', async () => {
    const controller = new AbortController()
    const mock = createMockFs()
    const { result } = await runDesktop(mock, {
      signal: controller.signal,
      renderBuilding: async () => {
        controller.abort()
        return FAKE_PNG
      }
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.cancelled).toBe(true)
    expect(mock.calls.some((call) => call.startsWith('writeFile:'))).toBe(false)
  })

  it('同名目录已存在时追加 -2 后缀，不覆盖旧档案', async () => {
    const mock = createMockFs({ collisionOnce: true })
    const { result } = await runDesktop(mock)
    expect(result.ok).toBe(true)
    if (!result.ok || result.mode !== 'desktop') return
    expect(result.dir).toMatch(/-2$/)
  })

  it('并发保护：导出进行中再次调用返回 busy', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const mock = createMockFs()
    const first = runDesktop(mock, {
      renderBuilding: async () => {
        await gate
        return FAKE_PNG
      }
    })
    await Promise.resolve()
    expect(isArchiveExporting()).toBe(true)
    const second = await runDesktop(createMockFs())
    expect(second.result).toEqual({ ok: false, cancelled: false, error: 'busy' })
    release()
    await first
    expect(isArchiveExporting()).toBe(false)
  })
})

describe('runArchiveExport（浏览器 ZIP）', () => {
  it('返回单个 ZIP：条目数正确、state 可 round-trip、文件名含时间戳', async () => {
    const { state, stateJson } = archiveState({ builds: plantBlocks() })
    const result = await runArchiveExport({
      state,
      stateJson,
      appVersion: '0.2.0',
      platform: 'browser',
      lang: 'zh',
      renderBuilding: async () => FAKE_PNG,
      now: new Date(Date.UTC(2026, 10, 10, 12, 0, 0))
    })
    expect(result.ok).toBe(true)
    if (!result.ok || result.mode !== 'browser') throw new Error('browser export failed')
    expect(result.filename).toBe('BlockHabit-Archive-2026-11-10T12-00-00Z.zip')
    const parsed = parseZip(result.zip)
    expect(parsed.entries).toHaveLength(result.files)
    const stateEntry = parsed.entries.find((entry) => entry.path === 'data/blockhabit-state.json')
    expect(stateEntry).toBeDefined()
    const stateBytes = await entryBytes(stateEntry!)
    expect(prepareImport(JSON.parse(utf8Decode(stateBytes)))).not.toBeNull()
    const manifestEntry = parsed.entries.find((entry) => entry.path === 'manifest.json')
    const manifest = JSON.parse(utf8Decode(await entryBytes(manifestEntry!)))
    expect(manifest.archiveFormatVersion).toBe(ARCHIVE_FORMAT_VERSION)
    expect(manifest.appContentVersion).toBe(CONTENT_VERSION)
    expect(manifest.platform).toBe('browser')
    expect(result.bytes).toBe(result.zip.length)
  })

  it('downloadBlobFile：Blob + <a download> 触发下载（文件名正确）', () => {
    const clicks: string[] = []
    const original = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicks.push(this.download)
    }
    try {
      expect(downloadBlobFile('BlockHabit-Archive-test.zip', FAKE_PNG)).toBe(true)
      expect(clicks).toEqual(['BlockHabit-Archive-test.zip'])
    } finally {
      HTMLAnchorElement.prototype.click = original
    }
  })
})

/* ---------------- 建筑图渲染 ---------------- */

describe('renderBuildingPng（离屏建筑图）', () => {
  it('jsdom 无 2D context 时返回 null（不阻塞导出，走 warnings）', async () => {
    await expect(renderBuildingPng('plant')).resolves.toBeNull()
  })

  it('尺寸常量符合「透明 2×」约定', () => {
    expect(ARCHIVE_BUILDING_SIZE).toBe(320)
    expect(ARCHIVE_BUILDING_SIZE * 2).toBe(640)
  })
})
