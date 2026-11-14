/**
 * A4 档案包测试共享夹具（自 archive.test.ts 拆分，D-20261110-062）：
 * BASE_STATE / archiveState / plantBlocks / FAKE_PNG / ZIP 解析器 / mock fs。
 * 文件名不以 .test 结尾，避免被 vitest 收集为测试文件。
 */

import type { AppState, PlacedBlock } from '../types'
import { blueprints } from '../logic/blueprints'
import { prepareImport } from './adapter'
import { serializeState } from '../store/serializeState'
import { ARCHIVE_TMP_PREFIX, utf8Decode, type ArchiveFs } from './archive'

/* ---------------- 夹具 ---------------- */

export const BASE_STATE: AppState = {
  schemaVersion: 2,
  habits: [
    { id: 'h1', name: '读书', frequency: { type: 'daily' }, createdAt: '2026-01-01T08:00:00.000Z' }
  ],
  checkIns: [],
  builds: [],
  activeBlueprintId: 'plant',
  completedBlueprintIds: [],
  settings: { theme: 'light', language: 'zh' },
  dayClaims: [],
  deletedDayClaims: []
}

export function archiveState(overrides: Partial<AppState> = {}): {
  state: AppState
  stateJson: string
} {
  const raw = { ...BASE_STATE, ...overrides }
  const normalized = prepareImport(JSON.parse(JSON.stringify(raw)))
  if (!normalized) throw new Error('invalid test state')
  const state = serializeState(normalized)
  return { state, stateJson: JSON.stringify(state, null, 2) }
}

export function plantBlocks(overrides: { placedAt?: string; count?: number } = {}): PlacedBlock[] {
  const capacity = blueprints.plant.blocks.length
  const count = overrides.count ?? capacity
  const placedAt = overrides.placedAt ?? new Date(2026, 2, 12, 12).toISOString()
  return blueprints.plant.blocks.slice(0, count).map((_, index) => ({
    id: `plant-${index}`,
    blueprintId: 'plant',
    index,
    placedAt,
    fromHabitId: 'h1',
    bonus: false
  }))
}

export const FAKE_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3])

export interface ParsedZipEntry {
  path: string
  method: number
  crc: number
  compressedSize: number
  uncompressedSize: number
  data: Uint8Array
  localOffset: number
}

export interface ParsedZip {
  entries: ParsedZipEntry[]
  centralOffset: number
  centralSize: number
  eocdOffset: number
  flags: number[]
}

/** 测试用最小 ZIP 中央目录解析器（外部可读性验证：不是自己写自己读） */
export function parseZip(bytes: Uint8Array): ParsedZip {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocdOffset = -1
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) throw new Error('EOCD not found')
  const count = view.getUint16(eocdOffset + 10, true)
  const centralSize = view.getUint32(eocdOffset + 12, true)
  const centralOffset = view.getUint32(eocdOffset + 16, true)
  const entries: ParsedZipEntry[] = []
  const flags: number[] = []
  let cursor = centralOffset
  for (let index = 0; index < count; index++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('bad central header')
    const flag = view.getUint16(cursor + 8, true)
    flags.push(flag)
    const method = view.getUint16(cursor + 10, true)
    const crc = view.getUint32(cursor + 16, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const path = utf8Decode(bytes.slice(cursor + 46, cursor + 46 + nameLength))
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('bad local header')
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    entries.push({
      path,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      data: bytes.slice(dataStart, dataStart + compressedSize),
      localOffset
    })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return { entries, centralOffset, centralSize, eocdOffset, flags }
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export function entryBytes(entry: ParsedZipEntry): Promise<Uint8Array> {
  return entry.method === 8 ? inflateRaw(entry.data) : Promise.resolve(entry.data)
}

/* ---------------- mock fs ---------------- */

export function createMockFs(options: { failWriteAt?: number; collisionOnce?: boolean } = {}) {
  const calls: string[] = []
  const dirs = new Set<string>()
  const files = new Map<string, Uint8Array | string>()
  let writeCount = 0
  let finalExistsCalls = 0
  const fs: ArchiveFs = {
    async appDataDir() {
      calls.push('appDataDir')
      return 'C:/AppData/BlockHabit'
    },
    async join(...parts: string[]) {
      return parts.join('/').replace(/\/{2,}/g, '/')
    },
    async mkdir(path: string) {
      calls.push('mkdir:' + path)
      dirs.add(path)
    },
    async writeFile(path: string, bytes: Uint8Array) {
      calls.push('writeFile:' + path)
      writeCount += 1
      if (options.failWriteAt !== undefined && writeCount === options.failWriteAt)
        throw new Error('disk full')
      files.set(path, bytes)
    },
    async writeTextFile(path: string, text: string) {
      calls.push('writeTextFile:' + path)
      writeCount += 1
      if (options.failWriteAt !== undefined && writeCount === options.failWriteAt)
        throw new Error('disk full')
      files.set(path, text)
    },
    async exists(path: string) {
      calls.push('exists:' + path)
      if (path.includes(ARCHIVE_TMP_PREFIX)) return false
      if (!options.collisionOnce) return false
      finalExistsCalls += 1
      return finalExistsCalls === 1
    },
    async rename(oldPath: string, newPath: string) {
      calls.push(`rename:${oldPath}->${newPath}`)
    },
    async remove(path: string) {
      calls.push('remove:' + path)
    },
    async reveal(path: string) {
      calls.push('reveal:' + path)
    }
  }
  return { fs, calls, dirs, files }
}
