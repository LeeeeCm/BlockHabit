import { describe, expect, it, vi, afterEach } from 'vitest'
import { blueprints } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { getTranslation } from '../i18n'
import { prepareImport } from './adapter'
import {
  ARCHIVE_CONTENT_VERSION,
  ARCHIVE_FOLDER_PREFIX,
  ARCHIVE_FORMAT_VERSION,
  archiveFolderName,
  archiveStamp,
  archiveZipFileName,
  assertNoCredentials,
  buildArchivePackage,
  buildZip,
  completedBuildings,
  crc32,
  deepEqualJson,
  dosDateTime,
  parseArchiveManifest,
  sha256Hex,
  sha256HexPure,
  utf8Decode,
  utf8Encode,
  verifyStateRoundTrip,
  type ZipEntryInput
} from './archive'
import { archiveState, entryBytes, FAKE_PNG, parseZip, plantBlocks } from './archiveTestUtils'

/**
 * A4 档案包（D-20261110-062）：
 * ZIP STORE+CRC32、SHA-256（WebCrypto + 纯 TS 兜底）、state round-trip、
 * 凭据断言、manifest/checksums 一致、失败清理与取消、浏览器 ZIP 路径。
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

/* ---------------- CRC32 / SHA-256 ---------------- */

describe('crc32 / sha256', () => {
  it('CRC32 已知向量（"123456789" = 0xCBF43926，空串 = 0）', () => {
    expect(crc32(utf8Encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array(0))).toBe(0)
  })

  it('SHA-256 已知向量（空串 / abc）', async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
    expect(await sha256Hex(utf8Encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('纯 TS 兜底与 WebCrypto 结果一致（无 subtle 环境仍可校验）', async () => {
    const bytes = utf8Encode('BlockHabit archive integrity check 档案包')
    const viaCrypto = await sha256Hex(bytes)
    expect(sha256HexPure(bytes)).toBe(viaCrypto)
    vi.stubGlobal('crypto', {})
    expect(await sha256Hex(bytes)).toBe(viaCrypto)
  })
})

describe('ZIP（STORE + 可选 DEFLATE）', () => {
  const entries: ZipEntryInput[] = [
    { path: 'README.md', bytes: utf8Encode('# 档案包\nBlockHabit') },
    { path: 'data/blockhabit-state.json', bytes: utf8Encode('{"schemaVersion":2}') },
    { path: 'buildings/01-plant.png', bytes: FAKE_PNG }
  ]

  it('中央目录/本地头/EOCD 自洽，CRC 与大小正确，UTF-8 文件名标志位', async () => {
    const zip = await buildZip(entries, new Date(2026, 10, 10, 20, 34, 12))
    const parsed = parseZip(zip)
    expect(parsed.entries.map((entry) => entry.path)).toEqual(entries.map((entry) => entry.path))
    expect(parsed.centralOffset + parsed.centralSize).toBe(parsed.eocdOffset)
    expect(parsed.eocdOffset + 22).toBe(zip.length)
    expect(parsed.flags.every((flag) => (flag & 0x0800) !== 0)).toBe(true)
    for (let index = 0; index < entries.length; index++) {
      const entry = parsed.entries[index]
      const original = entries[index].bytes
      expect(entry.crc).toBe(crc32(original))
      expect(entry.uncompressedSize).toBe(original.length)
      const restored = await entryBytes(entry)
      expect(Array.from(restored)).toEqual(Array.from(original))
      expect(entry.localOffset).toBeGreaterThanOrEqual(0)
    }
  })

  it('CompressionStream 不可用时全 STORE 仍产出合法 ZIP', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    const zip = await buildZip(entries)
    const parsed = parseZip(zip)
    expect(parsed.entries.every((entry) => entry.method === 0)).toBe(true)
    for (let index = 0; index < entries.length; index++) {
      expect(Array.from(parsed.entries[index].data)).toEqual(Array.from(entries[index].bytes))
    }
  })

  it('大文本在 CompressionStream 可用时降为 DEFLATE（method 8）且可解压还原', async () => {
    let capable = false
    if (typeof CompressionStream === 'function' && typeof Response !== 'undefined') {
      try {
        await new Response(
          new Blob([new Uint8Array([1, 2, 3]) as unknown as BlobPart])
            .stream()
            .pipeThrough(new CompressionStream('deflate-raw'))
        ).arrayBuffer()
        capable = true
      } catch {
        capable = false
      }
    }
    const text = utf8Encode('重复内容 '.repeat(400))
    const zip = await buildZip([{ path: 'README.md', bytes: text }])
    const parsed = parseZip(zip)
    if (!capable) {
      // 环境不支持 raw DEFLATE：必须优雅降级为 STORE，而不是整个导出失败
      expect(parsed.entries[0].method).toBe(0)
      expect(Array.from(parsed.entries[0].data)).toEqual(Array.from(text))
      return
    }
    expect(parsed.entries[0].method).toBe(8)
    expect(parsed.entries[0].compressedSize).toBeLessThan(text.length)
    expect(Array.from(await entryBytes(parsed.entries[0]))).toEqual(Array.from(text))
  })

  it('DOS 时间字段合法（1980 起，年份/月/日可还原）', () => {
    const now = new Date(2026, 10, 10, 20, 34, 12)
    const { time, date } = dosDateTime(now)
    expect((date >> 9) + 1980).toBe(2026)
    expect((date >> 5) & 0xf).toBe(11)
    expect(date & 0x1f).toBe(10)
    expect((time >> 11) & 0x1f).toBe(20)
    expect((time >> 5) & 0x3f).toBe(34)
    expect(dosDateTime(new Date(1970, 0, 1)).date >> 9).toBe(0)
  })
})

describe('文件名与时间戳', () => {
  it('目录名/ZIP 名含 UTC 时间戳、无冒号（Windows 安全）', () => {
    const now = new Date(Date.UTC(2026, 10, 10, 12, 34, 56))
    const stamp = archiveStamp(now)
    expect(stamp).toBe('2026-11-10T12-34-56Z')
    expect(archiveFolderName(now)).toBe(`${ARCHIVE_FOLDER_PREFIX}${stamp}`)
    expect(archiveZipFileName(now)).toBe(`${ARCHIVE_FOLDER_PREFIX}${stamp}.zip`)
    expect(stamp.includes(':')).toBe(false)
  })
})

/* ---------------- 已落成建筑 ---------------- */

describe('completedBuildings', () => {
  it('只收块数达到蓝图容量的建筑，落成日 = max(placedAt) 本地日期键', () => {
    const { state } = archiveState({ builds: plantBlocks() })
    const buildings = completedBuildings(state)
    expect(buildings).toHaveLength(1)
    expect(buildings[0].blueprintId).toBe('plant')
    expect(buildings[0].completedAt).toBe('2026-03-12')
    expect(buildings[0].blocks).toBe(blueprints.plant.blocks.length)
  })

  it('块数不足 / 墓碑积木不计入', () => {
    const insufficient = archiveState({ builds: plantBlocks({ count: 2 }) })
    expect(completedBuildings(insufficient.state)).toEqual([])

    const withTombstone = plantBlocks()
    withTombstone[withTombstone.length - 1] = {
      ...withTombstone[withTombstone.length - 1],
      deletedAt: new Date().toISOString()
    }
    expect(completedBuildings(archiveState({ builds: withTombstone }).state)).toEqual([])
  })

  it('奠基石铭言去空白；多座建筑按落成日升序', () => {
    const plant = plantBlocks({ placedAt: new Date(2026, 5, 1, 12).toISOString() })
    const coffee = blueprints.coffee.blocks.map((_, index) => ({
      id: `coffee-${index}`,
      blueprintId: 'coffee',
      index,
      placedAt: new Date(2026, 1, 1, 12).toISOString(),
      fromHabitId: 'h1',
      bonus: false
    }))
    const { state } = archiveState({
      builds: [...plant, ...coffee],
      foundationNotes: { plant: '  从一颗种子开始。 ', coffee: '每天一杯。' }
    })
    const buildings = completedBuildings(state)
    expect(buildings.map((building) => building.blueprintId)).toEqual(['coffee', 'plant'])
    expect(buildings[1].foundationNote).toBe('从一颗种子开始。')
  })
})

/* ---------------- round-trip / 凭据 ---------------- */

describe('state round-trip 与凭据断言', () => {
  it('导出 JSON 能被 prepareImport 读回且与导出前一致', () => {
    const { state, stateJson } = archiveState({
      builds: plantBlocks(),
      dayClaims: [
        {
          date: '2026-03-12',
          claimedAt: '2026-03-12T21:00:00.000Z',
          blockId: 'b1',
          blueprintId: 'plant'
        }
      ]
    })
    expect(verifyStateRoundTrip(stateJson, state)).toBe(true)
  })

  it('被篡改/损坏的 JSON 判定失败', () => {
    const { state, stateJson } = archiveState()
    const parsed = JSON.parse(stateJson)
    parsed.checkIns.push({ id: 'c1', habitId: 'h1', date: 'not-a-date', at: 'bad' })
    expect(verifyStateRoundTrip(JSON.stringify(parsed), state)).toBe(false)
    expect(verifyStateRoundTrip('{oops', state)).toBe(false)
    const other = archiveState({ habits: [] })
    expect(verifyStateRoundTrip(stateJson, other.state)).toBe(false)
  })

  it('凭据断言：password 键 / 已知凭据值都不允许出现', () => {
    expect(assertNoCredentials('{"schemaVersion":2}', [])).toEqual({ ok: true })
    expect(assertNoCredentials('{"password":"hunter2"}', [])).toEqual({ ok: false, reason: 'key' })
    expect(assertNoCredentials('{"note":"token"}', [])).toEqual({ ok: true })
    expect(assertNoCredentials('{"note":"hunter2"}', ['hunter2'])).toEqual({
      ok: false,
      reason: 'value'
    })
    expect(assertNoCredentials('{"note":"ab"}', ['ab'])).toEqual({ ok: true })
  })

  it('deepEqualJson 忽略对象键顺序', () => {
    expect(deepEqualJson({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true)
    expect(deepEqualJson({ a: 1 }, { a: 2 })).toBe(false)
    expect(deepEqualJson([1, 2], [1])).toBe(false)
  })
})

/* ---------------- 档案包组装 ---------------- */

describe('buildArchivePackage', () => {
  async function buildPackage(overrides: Partial<Parameters<typeof buildArchivePackage>[0]> = {}) {
    const { state, stateJson } = archiveState({
      builds: plantBlocks(),
      foundationNotes: { plant: '从一颗种子开始。' }
    })
    return buildArchivePackage({
      state,
      stateJson,
      appVersion: '0.2.0',
      platform: 'desktop',
      lang: 'zh',
      buildings: [{ blueprintId: 'plant', png: FAKE_PNG }],
      exportedAt: new Date(Date.UTC(2026, 10, 10, 12, 0, 0)),
      ...overrides
    })
  }

  it('文件清单完整：README/manifest/state/checksums/建筑图 + buildings/README', async () => {
    const result = await buildPackage()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const paths = result.package.files.map((file) => file.path)
    expect(paths).toContain('README.md')
    expect(paths).toContain('manifest.json')
    expect(paths).toContain('data/blockhabit-state.json')
    expect(paths).toContain('data/checksums.txt')
    expect(paths).toContain('buildings/README.md')
    expect(paths).toContain('buildings/01-plant.png')
    expect(result.package.warnings).toEqual([])
  })

  it('manifest 与 checksums 一致（每文件 bytes/sha256 对得上）', async () => {
    const result = await buildPackage()
    if (!result.ok) throw new Error('package failed')
    const { package: pkg } = result
    expect(pkg.manifest.archiveFormatVersion).toBe(ARCHIVE_FORMAT_VERSION)
    expect(pkg.manifest.appContentVersion).toBe(CONTENT_VERSION)
    expect(pkg.manifest.schemaVersion).toBe(2)
    expect(pkg.manifest.exportedAt).toBe('2026-11-10T12:00:00.000Z')
    expect(pkg.manifest.platform).toBe('desktop')

    const checksumLines = pkg.checksums.trim().split('\n')
    expect(checksumLines).toHaveLength(pkg.manifest.files.length)
    for (const file of pkg.manifest.files) {
      const source = pkg.files.find((candidate) => candidate.path === file.path)
      expect(source, file.path).toBeDefined()
      expect(file.bytes).toBe(source!.bytes.length)
      expect(file.sha256).toBe(await sha256Hex(source!.bytes))
      const line = checksumLines.find((candidate) => candidate.endsWith('  ' + file.path))
      expect(line, file.path).toBeDefined()
      expect(line!.slice(0, 64)).toBe(file.sha256)
    }
    // manifest/checksums 自身不进入清单（避免自引用）
    expect(pkg.manifest.files.some((file) => file.path === 'manifest.json')).toBe(false)
    expect(pkg.manifest.files.some((file) => file.path === 'data/checksums.txt')).toBe(false)
  })

  it('README 必含恢复/校验/隐私说明与双语小节；建筑 README 含名称/日期/铭言', async () => {
    const result = await buildPackage()
    if (!result.ok) throw new Error('package failed')
    const readme = utf8Decode(result.package.files.find((file) => file.path === 'README.md')!.bytes)
    expect(readme).toContain('如何恢复')
    expect(readme).toContain('data/blockhabit-state.json')
    expect(readme).toContain('sha256sum -c')
    expect(readme).toContain('WebDAV')
    expect(readme).toContain('How to restore')
    expect(readme).toContain('0.2.0')
    expect(readme).toContain(`archiveFormatVersion: ${ARCHIVE_FORMAT_VERSION}`)
    expect(readme).toContain(`appContentVersion: ${CONTENT_VERSION}`)
    expect(readme).toContain('与存档里的 `contentVersion` 无关')
    const buildingsReadme = utf8Decode(
      result.package.files.find((file) => file.path === 'buildings/README.md')!.bytes
    )
    expect(buildingsReadme).toContain(getTranslation('zh').blueprints.plant)
    expect(buildingsReadme).toContain(getTranslation('en').blueprints.plant)
    expect(buildingsReadme).toContain('2026-03-12')
    expect(buildingsReadme).toContain('从一颗种子开始。')
  })

  it('state JSON 是「导出数据」同款，可被 prepareImport 读回', async () => {
    const result = await buildPackage()
    if (!result.ok) throw new Error('package failed')
    const stateFile = result.package.files.find(
      (file) => file.path === 'data/blockhabit-state.json'
    )!
    const prepared = prepareImport(JSON.parse(utf8Decode(stateFile.bytes)))
    expect(prepared).not.toBeNull()
    expect(completedBuildings(prepared!)).toHaveLength(1)
  })

  it('建筑图渲染失败时：仍生成合法包，只在 warnings 里标注', async () => {
    const result = await buildPackage({ buildings: [{ blueprintId: 'plant', png: null }] })
    if (!result.ok) throw new Error('package failed')
    expect(result.package.warnings).toContain('building-image-missing:plant')
    expect(result.package.files.some((file) => file.path.endsWith('.png'))).toBe(false)
  })

  it('没有落成建筑时仍生成合法空包', async () => {
    const { state, stateJson } = archiveState()
    const result = await buildArchivePackage({
      state,
      stateJson,
      appVersion: '0.2.0',
      platform: 'browser',
      lang: 'en',
      buildings: []
    })
    if (!result.ok) throw new Error('package failed')
    expect(result.package.files.some((file) => file.path.startsWith('buildings/0'))).toBe(false)
    const buildingsReadme = utf8Decode(
      result.package.files.find((file) => file.path === 'buildings/README.md')!.bytes
    )
    expect(buildingsReadme).toContain('No buildings')
  })

  it('round-trip 不一致 / 凭据泄漏时拒绝生成', async () => {
    const { stateJson } = archiveState()
    const other = archiveState({ habits: [] })
    const roundTrip = await buildArchivePackage({
      state: other.state,
      stateJson,
      appVersion: '0.2.0',
      platform: 'desktop',
      lang: 'zh',
      buildings: []
    })
    expect(roundTrip).toEqual({ ok: false, error: 'round-trip' })

    const secretState = archiveState({
      habits: [
        {
          id: 'h1',
          name: 'hunter2',
          frequency: { type: 'daily' },
          createdAt: '2026-01-01T08:00:00.000Z'
        }
      ]
    })
    const leaked = await buildArchivePackage({
      state: secretState.state,
      stateJson: secretState.stateJson,
      appVersion: '0.2.0',
      platform: 'desktop',
      lang: 'zh',
      buildings: [],
      secrets: ['hunter2']
    })
    expect(leaked).toEqual({ ok: false, error: 'credentials' })
  })
})

/* ---------------- manifest 版本语义 / 旧档兼容 ---------------- */

describe('manifest 版本语义（archiveFormatVersion / appContentVersion）', () => {
  async function buildManifestPackage() {
    const { state, stateJson } = archiveState({ builds: plantBlocks() })
    const result = await buildArchivePackage({
      state,
      stateJson,
      appVersion: '0.2.0',
      platform: 'desktop',
      lang: 'zh',
      buildings: [{ blueprintId: 'plant', png: FAKE_PNG }],
      exportedAt: new Date(Date.UTC(2026, 10, 10, 12, 0, 0))
    })
    if (!result.ok) throw new Error('package failed')
    const manifestFile = result.package.files.find((file) => file.path === 'manifest.json')!
    return {
      pkg: result.package,
      raw: JSON.parse(utf8Decode(manifestFile.bytes)) as Record<string, unknown>
    }
  }

  it('新 manifest 写 archiveFormatVersion + appContentVersion，不再写旧 contentVersion 字段', async () => {
    const { pkg, raw } = await buildManifestPackage()
    expect(raw.archiveFormatVersion).toBe(ARCHIVE_FORMAT_VERSION)
    expect(raw.appContentVersion).toBe(CONTENT_VERSION)
    expect(raw).not.toHaveProperty('contentVersion')
    // 两个版本号语义独立：格式版本保持 1，内容版本随内置蓝图包 +1
    expect(ARCHIVE_FORMAT_VERSION).toBe(1)
    expect(CONTENT_VERSION).toBeGreaterThanOrEqual(2)
    expect(pkg.manifest.archiveFormatVersion).toBe(ARCHIVE_FORMAT_VERSION)
    expect(pkg.manifest.appContentVersion).toBe(CONTENT_VERSION)
  })

  it('旧 manifest（只有旧字段 contentVersion）仍可解析：回退为 archiveFormatVersion', () => {
    const legacy = {
      appVersion: '0.2.0',
      schemaVersion: 2,
      contentVersion: 1,
      exportedAt: '2026-11-10T12:00:00.000Z',
      platform: 'desktop',
      files: [{ path: 'README.md', bytes: 12, sha256: 'a'.repeat(64) }]
    }
    const parsed = parseArchiveManifest(legacy)
    expect(parsed).toEqual({
      appVersion: '0.2.0',
      schemaVersion: 2,
      archiveFormatVersion: 1,
      appContentVersion: CONTENT_VERSION,
      exportedAt: '2026-11-10T12:00:00.000Z',
      platform: 'desktop',
      files: [{ path: 'README.md', bytes: 12, sha256: 'a'.repeat(64) }]
    })
  })

  it('新 manifest 可 round-trip 解析，文件清单与 checksums 一致', async () => {
    const { pkg, raw } = await buildManifestPackage()
    const parsed = parseArchiveManifest(raw)
    expect(parsed).not.toBeNull()
    expect(parsed!.files).toEqual(pkg.manifest.files)
    expect(parsed!.archiveFormatVersion).toBe(ARCHIVE_FORMAT_VERSION)
    expect(parsed!.appContentVersion).toBe(CONTENT_VERSION)
    expect(parsed!.exportedAt).toBe(pkg.manifest.exportedAt)
  })

  it('非法 / 缺字段 / 未知 platform 的 manifest 返回 null', () => {
    expect(parseArchiveManifest(null)).toBeNull()
    expect(parseArchiveManifest({})).toBeNull()
    expect(
      parseArchiveManifest({
        appVersion: '0.2.0',
        schemaVersion: 2,
        exportedAt: 'x',
        platform: 'web',
        files: []
      })
    ).toBeNull()
    expect(
      parseArchiveManifest({
        appVersion: '0.2.0',
        schemaVersion: 2,
        exportedAt: 'x',
        platform: 'desktop',
        files: [{ path: 'README.md', bytes: 1, sha256: 'not-a-sha' }]
      })
    ).toBeNull()
  })

  it('未来格式版本原样解析（由调用方决定兼容策略），不静默改写成当前版本', () => {
    const parsed = parseArchiveManifest({
      appVersion: '0.3.0',
      schemaVersion: 2,
      archiveFormatVersion: ARCHIVE_FORMAT_VERSION + 1,
      appContentVersion: CONTENT_VERSION,
      exportedAt: '2026-11-11T00:00:00.000Z',
      platform: 'browser',
      files: []
    })
    expect(parsed?.archiveFormatVersion).toBe(ARCHIVE_FORMAT_VERSION + 1)
  })

  it('ARCHIVE_CONTENT_VERSION 仅为旧名别名（= ARCHIVE_FORMAT_VERSION）', () => {
    expect(ARCHIVE_CONTENT_VERSION).toBe(ARCHIVE_FORMAT_VERSION)
  })
})
