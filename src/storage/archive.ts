import type { AppState, Language } from '../types'
import { blueprints } from '../logic/blueprints'
import { BLUEPRINT_CAPACITY } from '../logic/builds'
import { dateKey } from '../logic/dates'
import { getTranslation } from '../i18n'
import { prepareImport, SCHEMA_VERSION } from './adapter'
import { serializeState } from '../store/serializeState'

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
/** 档案包内容格式版本（与存档 schemaVersion 分开，便于未来演进） */
export const ARCHIVE_CONTENT_VERSION = 1
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

/* ---------------- CRC32 / SHA-256 ---------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** CRC-32（IEEE 802.3，ZIP 用），返回无符号 32 位 */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

/** 纯 TS SHA-256 兜底（无 WebCrypto 的旧 WebView 仍能校验完整性） */
export function sha256HexPure(input: Uint8Array): string {
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const bitLength = input.length * 8
  const paddedLength = ((input.length + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(paddedLength)
  padded.set(input)
  padded[input.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const w = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const s0 = (w[i - 15] >>> 7) | (w[i - 15] << 25)
      const s1 = (w[i - 2] >>> 17) | (w[i - 2] << 15)
      const r0 = (w[i - 15] >>> 18) | (w[i - 15] << 14)
      const r1 = (w[i - 2] >>> 19) | (w[i - 2] << 13)
      const sh0 = w[i - 15] >>> 3
      const sh1 = w[i - 2] >>> 10
      w[i] = (w[i - 16] + (s0 ^ r0 ^ sh0) + w[i - 7] + (s1 ^ r1 ^ sh1)) >>> 0
    }
    let a = h[0]
    let b = h[1]
    let c = h[2]
    let d = h[3]
    let e = h[4]
    let f = h[5]
    let g = h[6]
    let hh = h[7]
    for (let i = 0; i < 64; i++) {
      const S1 = (e >>> 6) | (e << 26)
      const S2 = (e >>> 11) | (e << 21)
      const S3 = (e >>> 25) | (e << 7)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + (S1 ^ S2 ^ S3) + ch + k[i] + w[i]) >>> 0
      const S4 = (a >>> 2) | (a << 30)
      const S5 = (a >>> 13) | (a << 19)
      const S6 = (a >>> 22) | (a << 10)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = ((S4 ^ S5 ^ S6) + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }
  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false)
  return toHex(out)
}

/** SHA-256 十六进制摘要：优先 WebCrypto，失败/缺失时用纯 TS 兜底 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle =
    typeof crypto !== 'undefined' && crypto && typeof crypto.subtle?.digest === 'function'
      ? crypto.subtle
      : null
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource)
      return toHex(new Uint8Array(digest))
    } catch {
      // 旧 WebView / 非安全上下文：走纯 TS
    }
  }
  return sha256HexPure(bytes)
}

/* ---------------- UTF-8 / 字节拼接 ---------------- */

export function utf8Encode(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text)
  const escaped = unescape(encodeURIComponent(text))
  const out = new Uint8Array(escaped.length)
  for (let i = 0; i < escaped.length; i++) out[i] = escaped.charCodeAt(i)
  return out
}

export function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return decodeURIComponent(escape(binary))
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/* ---------------- 无依赖 ZIP（STORE + 可选 DEFLATE） ---------------- */

export interface ZipEntryInput {
  /** ZIP 内相对路径（正斜杠） */
  path: string
  bytes: Uint8Array
}

/** MS-DOS 时间/日期（ZIP 本地头字段，1980 起） */
export function dosDateTime(now: Date): { time: number; date: number } {
  const year = Math.max(1980, now.getFullYear())
  const date = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  return { time, date }
}

/** 文本文件尝试 raw DEFLATE（CompressionStream）；不可用/更大时返回 null 降级 STORE */
async function tryDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  const Ctor = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream
  if (typeof Ctor !== 'function' || typeof Blob === 'undefined' || typeof Response === 'undefined') {
    return null
  }
  try {
    const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new Ctor('deflate-raw'))
    const buffer = await new Response(stream).arrayBuffer()
    return new Uint8Array(buffer)
  } catch {
    return null
  }
}

/**
 * 生成 ZIP（method 0 STORE，文本可降级/升级为 method 8 DEFLATE）：
 * 本地文件头 → 数据 → 中央目录 → EOCD；UTF-8 文件名（bit 11），无 data descriptor。
 */
export async function buildZip(entries: ZipEntryInput[], now: Date = new Date()): Promise<Uint8Array> {
  const { time, date } = dosDateTime(now)
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const pathBytes = utf8Encode(entry.path)
    const crc = crc32(entry.bytes)
    const deflated = entry.bytes.length >= 512 ? await tryDeflate(entry.bytes) : null
    const method = deflated && deflated.length < entry.bytes.length ? 8 : 0
    const data = method === 8 && deflated ? deflated : entry.bytes

    const local = new Uint8Array(30 + pathBytes.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, method, true)
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, entry.bytes.length, true)
    localView.setUint16(26, pathBytes.length, true)
    localView.setUint16(28, 0, true)
    local.set(pathBytes, 30)
    localParts.push(local, data)

    const central = new Uint8Array(46 + pathBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, method, true)
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, entry.bytes.length, true)
    centralView.setUint16(28, pathBytes.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    central.set(pathBytes, 46)
    centralParts.push(central)

    offset += local.length + data.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true)
  eocdView.setUint16(4, 0, true)
  eocdView.setUint16(6, 0, true)
  eocdView.setUint16(8, entries.length, true)
  eocdView.setUint16(10, entries.length, true)
  eocdView.setUint32(12, centralSize, true)
  eocdView.setUint32(16, offset, true)
  eocdView.setUint16(20, 0, true)

  return concatBytes([...localParts, ...centralParts, eocd])
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

export interface ArchiveBuilding {
  blueprintId: string
  /** 本地日期键（落成日 = 该蓝图全部积木 placedAt 最大值转本地日期） */
  completedAt: string
  blocks: number
  foundationNote?: string
}

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

export interface ArchiveManifestFile {
  path: string
  bytes: number
  sha256: string
}

export interface ArchiveManifest {
  appVersion: string
  schemaVersion: number
  contentVersion: number
  exportedAt: string
  platform: 'desktop' | 'browser'
  /** 文件清单（不含 manifest.json / checksums.txt 自身，避免自引用） */
  files: ArchiveManifestFile[]
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

function blueprintNames(blueprintId: string): { zh: string; en: string } {
  const zh = getTranslation('zh').blueprints[blueprintId] || blueprintId
  const en = getTranslation('en').blueprints[blueprintId] || blueprintId
  return { zh, en }
}

/** 人读 README（双语小节；档案包可能被十年后的自己或别人打开） */
export function buildArchiveReadme(input: {
  appVersion: string
  schemaVersion: number
  contentVersion: number
  exportedAt: string
  files: ArchiveManifestFile[]
  buildings: ArchiveBuilding[]
}): string {
  const lines: string[] = []
  lines.push('# BlockHabit 完整档案包 / Complete Archive', '')
  lines.push(`- appVersion: ${input.appVersion}`)
  lines.push(`- schemaVersion: ${input.schemaVersion}`)
  lines.push(`- contentVersion: ${input.contentVersion}`)
  lines.push(`- exportedAt: ${input.exportedAt}`)
  lines.push('', '## 这是什么 / What this is', '')
  lines.push('这是 BlockHabit 本地数据的只读快照，不含任何账号信息，也不含 WebDAV 凭据；生成过程不上传、不联网。')
  lines.push('This is a read-only snapshot of BlockHabit local data. No account information and no WebDAV credentials are included; nothing is uploaded.')
  lines.push('', '## 包含什么 / What is inside', '')
  lines.push('- `data/blockhabit-state.json` — 全部数据，可被应用「导入数据」直接读回 / all data, importable by the app')
  lines.push('- `data/checksums.txt` — 每个文件的 SHA-256（外部可校验）/ SHA-256 per file (verifiable outside the app)')
  lines.push('- `manifest.json` — 版本、导出时间与文件清单 / versions, export time and file list')
  lines.push('- `buildings/*.png` — 已落成建筑的等距渲染图（透明背景 2×）/ isometric renders of completed buildings (transparent, 2×)')
  lines.push('- `buildings/README.md` — 建筑名、落成日期与奠基石铭言 / building names, completion dates and foundation notes')
  lines.push('')
  lines.push(`建筑图数量 / Completed buildings: ${input.buildings.length}`)
  lines.push('')
  lines.push('## 如何恢复 / How to restore', '')
  lines.push('1. 打开 BlockHabit → 设置 → 数据备份 → 导入数据，选择 `data/blockhabit-state.json`。')
  lines.push('   Open BlockHabit → Settings → Data → Import data and choose `data/blockhabit-state.json`.')
  lines.push('2. 请使用与导出时相同或更新版本的应用（manifest 里的 schemaVersion 可用于判断兼容性）。')
  lines.push('   Use the same or a newer app version (see schemaVersion in manifest.json).')
  lines.push('3. 建筑图与年鉴图只是人看的派生文件，不参与恢复。')
  lines.push('   Building images are for human reading only; they are not part of the restore path.')
  lines.push('')
  lines.push('## 如何校验 / How to verify', '')
  lines.push('在档案包目录内执行 / run inside the archive folder:')
  lines.push('')
  lines.push('```')
  lines.push('sha256sum -c data/checksums.txt        # macOS / Linux')
  lines.push('Get-FileHash <file> -Algorithm SHA256  # Windows PowerShell（逐文件对照 checksums.txt）')
  lines.push('```')
  lines.push('')
  lines.push('校验和只能证明文件完整、未被改动，不能证明来源（档案包没有签名）。')
  lines.push('Checksums prove integrity, not authenticity — the archive is not signed.')
  lines.push('')
  lines.push('## 隐私提醒 / Privacy', '')
  lines.push('档案包含个人打卡与随笔，请自行保管；它没有加密，可以放进你自己的同步盘。')
  lines.push('The archive contains personal check-ins and notes; keep it safe. It is not encrypted, and you may store it in your own sync folder.')
  lines.push('', '## 文件清单 / File list', '')
  for (const file of input.files) {
    lines.push(`- ${file.path} (${file.bytes} bytes, sha256 ${file.sha256})`)
  }
  lines.push('')
  return lines.join('\n')
}

/** 建筑年表 README（双语；供人对照 PNG 阅读） */
export function buildBuildingsReadme(buildings: ArchiveBuilding[]): string {
  const lines: string[] = ['# 已落成建筑 / Completed buildings', '']
  if (buildings.length === 0) {
    lines.push('这份档案包生成时还没有落成的建筑。')
    lines.push('No buildings had been completed when this archive was created.')
    lines.push('')
    return lines.join('\n')
  }
  lines.push('| # | id | 名称 / Name | 落成日 / Completed | 铭言 / Foundation note |')
  lines.push('| --- | --- | --- | --- | --- |')
  buildings.forEach((building, index) => {
    const names = blueprintNames(building.blueprintId)
    const note = (building.foundationNote ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
    lines.push(
      `| ${index + 1} | ${building.blueprintId} | ${names.zh} / ${names.en} | ${building.completedAt} | ${note} |`,
    )
  })
  lines.push('')
  lines.push('图片为透明背景等距渲染（2×），只用于阅读，不参与数据恢复。')
  lines.push('Images are transparent isometric renders (2×) for reading only; they are not used for data restore.')
  lines.push('')
  return lines.join('\n')
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
    contentVersion: ARCHIVE_CONTENT_VERSION,
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
    contentVersion: ARCHIVE_CONTENT_VERSION,
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
