import type { AppState, Language } from '../types'
import { blueprints } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { BLUEPRINT_CAPACITY } from '../logic/builds'
import { dateKey } from '../logic/dates'
import { prepareImport, SCHEMA_VERSION } from './adapter'
import { serializeState } from '../store/serializeState'
import {
  ARCHIVE_FORMAT_VERSION,
  buildArchiveReadme,
  buildBuildingsReadme,
  type ArchiveBuilding,
  type ArchiveManifest,
  type ArchiveManifestFile,
} from './archiveManifest'
export * from './archiveManifest'
import { buildZip, sha256Hex, utf8Decode, utf8Encode } from './archiveZip'
export * from './archiveZip'

/**
 * A4 一键档案包（D-20261110-062）：纯逻辑 + 双端导出编排。
 *
 * 设计约束：
 * - **文件夹是权威产物**（README + manifest + 可导入 state JSON + checksums + 建筑图）；
 *   ZIP 只是浏览器端的单文件副本（桌面端可选），用无依赖 STORE + CRC32 实现；
 * - 数据只读快照：state JSON 必须能经 `prepareImport` round-trip（导回数据一致），
 *   且**绝不含 WebDAV 凭据**（防御性断言，凭据本就不在 AppState 里）；
 * - 先写 `.tmp-archive-<stamp>`，全部成功后 rename 成正式目录；失败/取消递归删除，不留半成品；
 * - 无新增依赖、无新增 AppState 字段；sha256 优先 WebCrypto，缺失时用纯 TS 兜底。
 */

export const ARCHIVE_FOLDER_PREFIX = 'BlockHabit-Archive-'
export const ARCHIVE_TMP_PREFIX = '.tmp-archive-'
/** 建筑图逻辑尺寸（透明背景，物理 2×） */
export const ARCHIVE_BUILDING_PX = 320

/* ---------------- 时间 / 文件名 ---------------- */

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** 目录名时间戳：2026-11-10T20-34-12Z（不含冒号，Windows 安全） */
export function archiveStamp(now: Date = new Date()): string {
  return (
    `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}` +
    `T${pad2(now.getUTCHours())}-${pad2(now.getUTCMinutes())}-${pad2(now.getUTCSeconds())}Z`
  )
}

export function archiveFolderName(now: Date = new Date()): string {
  return `${ARCHIVE_FOLDER_PREFIX}${archiveStamp(now)}`
}

export function archiveZipFileName(now: Date = new Date()): string {
  return `${ARCHIVE_FOLDER_PREFIX}${archiveStamp(now)}.zip`
}


/* ---------------- 深度比较 / 凭据断言 ---------------- */

export function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqualJson(item, b[index]))
  }
  if (typeof a === 'object') {
    const aRecord = a as Record<string, unknown>
    const bRecord = b as Record<string, unknown>
    const aKeys = Object.keys(aRecord)
    const bKeys = Object.keys(bRecord)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key) => key in bRecord && deepEqualJson(aRecord[key], bRecord[key]))
  }
  return false
}

/**
 * 数据 JSON 必须能被现有导入读回（prepareImport round-trip）。
 * 这是档案包的核心承诺：`data/blockhabit-state.json` 不是黑箱，直接可恢复。
 */
export function verifyStateRoundTrip(stateJson: string, state: AppState): boolean {
  try {
    const prepared = prepareImport(JSON.parse(stateJson))
    if (!prepared) return false
    return deepEqualJson(serializeState(prepared), serializeState(state))
  } catch {
    return false
  }
}

const CREDENTIAL_KEY_RE = /"(?:password|passwd|token|secret)"\s*:/i

export type CredentialCheck = { ok: true } | { ok: false; reason: 'key' | 'value' }

/**
 * 防御性断言：序列化结果中不得出现凭据字段/已知凭据值。
 * 凭据（WebDAV 配置）本就存在独立 localStorage key，不在 AppState 里；这里是第二道闸。
 */
export function assertNoCredentials(text: string, secrets: Array<string | undefined | null> = []): CredentialCheck {
  if (CREDENTIAL_KEY_RE.test(text)) return { ok: false, reason: 'key' }
  for (const secret of secrets) {
    const value = typeof secret === 'string' ? secret.trim() : ''
    if (value.length >= 3 && text.includes(value)) return { ok: false, reason: 'value' }
  }
  return { ok: true }
}

/* ---------------- 已落成建筑 ---------------- */

/** 只导出「已落成」建筑：块数达到蓝图容量；未完成不产生误导性的已完成图 */
export function completedBuildings(state: AppState): ArchiveBuilding[] {
  const out: ArchiveBuilding[] = []
  for (const blueprintId of Object.keys(blueprints)) {
    const capacity = BLUEPRINT_CAPACITY[blueprintId]
    if (!capacity) continue
    const blocks = state.builds.filter((block) => !block.deletedAt && block.blueprintId === blueprintId)
    if (blocks.length < capacity) continue
    let maxMs = -Infinity
    for (const block of blocks) {
      const ms = Date.parse(block.placedAt)
      if (Number.isFinite(ms) && ms > maxMs) maxMs = ms
    }
    if (maxMs === -Infinity) continue
    const note = state.foundationNotes?.[blueprintId]?.trim()
    out.push({
      blueprintId,
      completedAt: dateKey(new Date(maxMs)),
      blocks: capacity,
      foundationNote: note ? note : undefined,
    })
  }
  out.sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.blueprintId.localeCompare(b.blueprintId))
  return out
}

/* ---------------- 档案包组装（纯逻辑） ---------------- */

export interface ArchiveSourceFile {
  /** 包内相对路径（正斜杠） */
  path: string
  bytes: Uint8Array
}

export interface ArchivePackageInput {
  state: AppState
  /** appStore.exportData() 的输出（与「导出数据」完全一致） */
  stateJson: string
  appVersion: string
  schemaVersion?: number
  platform: 'desktop' | 'browser'
  lang: Language
  secrets?: Array<string | undefined | null>
  /** 已落成建筑与对应 PNG（null = 渲染失败，仍写入 buildings/README.md） */
  buildings: Array<{ blueprintId: string; png: Uint8Array | null }>
  exportedAt?: Date
}

export interface ArchivePackage {
  files: ArchiveSourceFile[]
  manifest: ArchiveManifest
  stateJson: string
  checksums: string
  warnings: string[]
}

export type ArchivePackageResult =
  | { ok: true; package: ArchivePackage }
  | { ok: false; error: 'state-parse' | 'round-trip' | 'credentials' }

function buildingFileName(index: number, blueprintId: string): string {
  return `buildings/${String(index + 1).padStart(2, '0')}-${blueprintId}.png`
}

/** checksums.txt：`<sha256>  <relative path>`（与 sha256sum -c 兼容） */
export function formatChecksums(files: ArchiveManifestFile[]): string {
  return files.map((file) => `${file.sha256}  ${file.path}`).join('\n') + '\n'
}

/** 组装档案包（纯逻辑，不写盘）：校验 round-trip、凭据、计算 sha256、生成 README/manifest/checksums */
export async function buildArchivePackage(input: ArchivePackageInput): Promise<ArchivePackageResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(input.stateJson)
  } catch {
    return { ok: false, error: 'state-parse' }
  }
  const prepared = prepareImport(parsed)
  if (!prepared || !deepEqualJson(serializeState(prepared), serializeState(input.state))) {
    return { ok: false, error: 'round-trip' }
  }
  if (!assertNoCredentials(input.stateJson, input.secrets ?? []).ok) {
    return { ok: false, error: 'credentials' }
  }

  const exportedAt = (input.exportedAt ?? new Date()).toISOString()
  const schemaVersion = input.schemaVersion ?? SCHEMA_VERSION
  const completed = completedBuildings(input.state)
  const warnings: string[] = []
  const renderedByBlueprint = new Map<string, Uint8Array | null>()
  for (const rendered of input.buildings) renderedByBlueprint.set(rendered.blueprintId, rendered.png)

  const files: ArchiveSourceFile[] = []
  const pushText = (path: string, text: string): void => {
    files.push({ path, bytes: utf8Encode(text) })
  }

  const pngEntries: Array<{ path: string; bytes: Uint8Array }> = []
  completed.forEach((building, index) => {
    const png = renderedByBlueprint.get(building.blueprintId) ?? null
    if (png) pngEntries.push({ path: buildingFileName(index, building.blueprintId), bytes: png })
    else warnings.push(`building-image-missing:${building.blueprintId}`)
  })
  for (const entry of pngEntries) files.push(entry)
  pushText('buildings/README.md', buildBuildingsReadme(completed))
  pushText('data/blockhabit-state.json', input.stateJson)

  // manifest 文件清单：先算除 README/manifest/checksums 之外的文件，再补文本
  const manifestFiles: ArchiveManifestFile[] = []
  for (const file of files) {
    manifestFiles.push({ path: file.path, bytes: file.bytes.length, sha256: await sha256Hex(file.bytes) })
  }

  // README 需要完整文件清单，先占位再生成最终版本（顺序：README 在最前）
  const provisionalReadme = buildArchiveReadme({
    appVersion: input.appVersion,
    schemaVersion,
    archiveFormatVersion: ARCHIVE_FORMAT_VERSION,
    appContentVersion: CONTENT_VERSION,
    exportedAt,
    files: manifestFiles,
    buildings: completed,
  })
  const readmeFile: ArchiveSourceFile = { path: 'README.md', bytes: utf8Encode(provisionalReadme) }
  const readmeEntry: ArchiveManifestFile = {
    path: 'README.md',
    bytes: readmeFile.bytes.length,
    sha256: await sha256Hex(readmeFile.bytes),
  }
  const checksumFiles = [readmeEntry, ...manifestFiles]
  checksumFiles.sort((a, b) => a.path.localeCompare(b.path))
  const checksums = formatChecksums(checksumFiles)

  const manifest: ArchiveManifest = {
    appVersion: input.appVersion,
    schemaVersion,
    archiveFormatVersion: ARCHIVE_FORMAT_VERSION,
    appContentVersion: CONTENT_VERSION,
    exportedAt,
    platform: input.platform,
    files: checksumFiles,
  }

  const orderedFiles: ArchiveSourceFile[] = [
    readmeFile,
    { path: 'manifest.json', bytes: utf8Encode(JSON.stringify(manifest, null, 2)) },
    { path: 'data/blockhabit-state.json', bytes: utf8Encode(input.stateJson) },
    { path: 'data/checksums.txt', bytes: utf8Encode(checksums) },
    { path: 'buildings/README.md', bytes: utf8Encode(buildBuildingsReadme(completed)) },
    ...pngEntries,
  ]

  return { ok: true, package: { files: orderedFiles, manifest, stateJson: input.stateJson, checksums, warnings } }
}

/* ---------------- 浏览器下载 ---------------- */

/** Blob + 临时 <a> 下载（不经过 base64，避免体积膨胀）；失败返回 false */
export function downloadBlobFile(filename: string, bytes: Uint8Array, mime = 'application/zip'): boolean {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return false
  }
  try {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // 忽略
      }
    }, 0)
    return true
  } catch {
    return false
  }
}

/* ---------------- 桌面端文件系统适配 ---------------- */

export interface ArchiveFs {
  appDataDir(): Promise<string>
  join(...parts: string[]): Promise<string>
  mkdir(path: string, recursive?: boolean): Promise<void>
  writeFile(path: string, bytes: Uint8Array): Promise<void>
  writeTextFile(path: string, text: string): Promise<void>
  exists(path: string): Promise<boolean>
  rename(oldPath: string, newPath: string): Promise<void>
  remove(path: string): Promise<void>
  reveal(path: string): Promise<void>
}

/** 默认实现：Tauri plugin-fs / plugin-opener（懒加载，浏览器端不会触发） */
export function createTauriArchiveFs(): ArchiveFs {
  return {
    async appDataDir() {
      const { appDataDir } = await import('@tauri-apps/api/path')
      return appDataDir()
    },
    async join(...parts: string[]) {
      const { join } = await import('@tauri-apps/api/path')
      return join(...parts)
    },
    async mkdir(path: string, recursive = true) {
      const { mkdir } = await import('@tauri-apps/plugin-fs')
      await mkdir(path, { recursive })
    },
    async writeFile(path: string, bytes: Uint8Array) {
      const { writeFile } = await import('@tauri-apps/plugin-fs')
      await writeFile(path, bytes)
    },
    async writeTextFile(path: string, text: string) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(path, text)
    },
    async exists(path: string) {
      const { exists } = await import('@tauri-apps/plugin-fs')
      return exists(path)
    },
    async rename(oldPath: string, newPath: string) {
      const { rename } = await import('@tauri-apps/plugin-fs')
      await rename(oldPath, newPath)
    },
    async remove(path: string) {
      const { remove } = await import('@tauri-apps/plugin-fs')
      await remove(path, { recursive: true })
    },
    async reveal(path: string) {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealItemInDir(path)
    },
  }
}

/** 用系统文件管理器定位档案包（revealItemInDir 在 opener:default 内，无需新权限） */
export async function revealArchivePath(path: string): Promise<boolean> {
  try {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
    await revealItemInDir(path)
    return true
  } catch {
    return false
  }
}

/* ---------------- 导出编排（进度 / 取消 / 失败清理 / 并发保护） ---------------- */

export type ArchivePhase = 'render' | 'checksum' | 'write'

export interface ArchiveProgress {
  phase: ArchivePhase
  done: number
  total: number
}

export interface RunArchiveOptions {
  state: AppState
  stateJson: string
  appVersion: string
  schemaVersion?: number
  platform: 'desktop' | 'browser'
  lang: Language
  secrets?: Array<string | undefined | null>
  /** 渲染单座已完成建筑 → 透明 2× PNG；null 表示该图渲染失败（不阻塞导出） */
  renderBuilding: (blueprintId: string) => Promise<Uint8Array | null>
  onProgress?: (progress: ArchiveProgress) => void
  signal?: AbortSignal
  /** 测试注入；缺省用 Tauri fs */
  fs?: ArchiveFs
  now?: Date
}

export type ArchiveRunResult =
  | {
      ok: true
      mode: 'desktop'
      dir: string
      readmePath: string
      files: number
      bytes: number
      manifest: ArchiveManifest
      warnings: string[]
    }
  | {
      ok: true
      mode: 'browser'
      zip: Uint8Array
      filename: string
      files: number
      bytes: number
      manifest: ArchiveManifest
      warnings: string[]
    }
  | { ok: false; cancelled: boolean; error?: string }

/** 模块级并发闸：双击/重复触发不会生成两份 */
let archiveExporting = false

export function isArchiveExporting(): boolean {
  return archiveExporting
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('archive export aborted', 'AbortError')
  }
}

async function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function totalBytesOf(files: ArchiveSourceFile[]): number {
  return files.reduce((sum, file) => sum + file.bytes.length, 0)
}

async function writePackageToFolder(
  fs: ArchiveFs,
  files: ArchiveSourceFile[],
  now: Date,
  onProgress: ((progress: ArchiveProgress) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<{ dir: string; readmePath: string }> {
  const stamp = archiveStamp(now)
  const appData = await fs.appDataDir()
  const exportsDir = await fs.join(appData, 'exports')
  const tmpDir = await fs.join(exportsDir, `${ARCHIVE_TMP_PREFIX}${stamp}`)
  let finalDir = await fs.join(exportsDir, `${ARCHIVE_FOLDER_PREFIX}${stamp}`)

  await fs.mkdir(exportsDir, true)
  // 上次崩溃/取消可能留下同名 tmp：先清再建
  try {
    if (await fs.exists(tmpDir)) await fs.remove(tmpDir)
  } catch {
    // 清理失败时 mkdir 会再报错，由外层统一处理
  }
  await fs.mkdir(tmpDir, true)
  await fs.mkdir(await fs.join(tmpDir, 'data'), true)
  await fs.mkdir(await fs.join(tmpDir, 'buildings'), true)

  for (let index = 0; index < files.length; index++) {
    throwIfAborted(signal)
    const file = files[index]
    onProgress?.({ phase: 'write', done: index, total: files.length })
    const segments = file.path.split('/')
    const target = await fs.join(tmpDir, ...segments)
    if (file.path.endsWith('.png')) {
      await fs.writeFile(target, file.bytes)
    } else {
      await fs.writeTextFile(target, utf8Decode(file.bytes))
    }
  }
  throwIfAborted(signal)
  onProgress?.({ phase: 'write', done: files.length, total: files.length })

  // 同名冲突：不覆盖已有档案包，追加 -2 / -3
  let suffix = 2
  while (await fs.exists(finalDir)) {
    finalDir = await fs.join(exportsDir, `${ARCHIVE_FOLDER_PREFIX}${stamp}-${suffix}`)
    suffix += 1
  }
  await fs.rename(tmpDir, finalDir)
  return { dir: finalDir, readmePath: await fs.join(finalDir, 'README.md') }
}

/**
 * 一键导出编排：
 * - render 阶段逐座建筑渲染（每座让出一帧，可取消）；
 * - checksum 阶段组装 manifest/checksums 并做 round-trip / 凭据断言；
 * - desktop：写 `.tmp-archive-*` → 成功后 rename → revealItemInDir；失败/取消递归清理；
 * - browser：返回内存 ZIP（调用方用 downloadBlobFile 触发下载）。
 */
export async function runArchiveExport(options: RunArchiveOptions): Promise<ArchiveRunResult> {
  if (archiveExporting) return { ok: false, cancelled: false, error: 'busy' }
  archiveExporting = true
  const now = options.now ?? new Date()
  const fs = options.fs ?? createTauriArchiveFs()
  let tmpMayExist = false
  try {
    const completed = completedBuildings(options.state)
    const rendered: Array<{ blueprintId: string; png: Uint8Array | null }> = []
    for (let index = 0; index < completed.length; index++) {
      throwIfAborted(options.signal)
      options.onProgress?.({ phase: 'render', done: index, total: completed.length })
      let png: Uint8Array | null = null
      try {
        png = await options.renderBuilding(completed[index].blueprintId)
      } catch {
        png = null
      }
      rendered.push({ blueprintId: completed[index].blueprintId, png })
      await nextFrame()
    }
    options.onProgress?.({ phase: 'render', done: completed.length, total: completed.length })

    throwIfAborted(options.signal)
    options.onProgress?.({ phase: 'checksum', done: 0, total: 1 })
    const built = await buildArchivePackage({
      state: options.state,
      stateJson: options.stateJson,
      appVersion: options.appVersion,
      schemaVersion: options.schemaVersion,
      platform: options.platform,
      lang: options.lang,
      secrets: options.secrets,
      buildings: rendered,
      exportedAt: now,
    })
    if (!built.ok) return { ok: false, cancelled: false, error: built.error }
    const pkg = built.package
    options.onProgress?.({ phase: 'checksum', done: 1, total: 1 })
    const bytes = totalBytesOf(pkg.files)

    if (options.platform === 'browser') {
      throwIfAborted(options.signal)
      const zip = await buildZip(pkg.files, now)
      return {
        ok: true,
        mode: 'browser',
        zip,
        filename: archiveZipFileName(now),
        files: pkg.files.length,
        bytes: zip.length,
        manifest: pkg.manifest,
        warnings: pkg.warnings,
      }
    }

    tmpMayExist = true
    const written = await writePackageToFolder(fs, pkg.files, now, options.onProgress, options.signal)
    tmpMayExist = false
    try {
      await fs.reveal(written.readmePath)
    } catch {
      // 打开目录失败不影响导出结果；UI 仍展示路径
    }
    return {
      ok: true,
      mode: 'desktop',
      dir: written.dir,
      readmePath: written.readmePath,
      files: pkg.files.length,
      bytes,
      manifest: pkg.manifest,
      warnings: pkg.warnings,
    }
  } catch (error) {
    if (tmpMayExist) {
      try {
        const appData = await fs.appDataDir()
        const exportsDir = await fs.join(appData, 'exports')
        await fs.remove(await fs.join(exportsDir, `${ARCHIVE_TMP_PREFIX}${archiveStamp(now)}`))
      } catch {
        // 清理失败不掩盖原始错误
      }
    }
    if (isAbortError(error)) return { ok: false, cancelled: true }
    return { ok: false, cancelled: false, error: error instanceof Error ? error.message : 'unknown' }
  } finally {
    archiveExporting = false
  }
}
