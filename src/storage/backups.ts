import type { AppState } from '../types'
import { prepareImport } from './adapter'

/**
 * 数据主权（F3）：应用内可见、可恢复的本地备份。
 *
 * 此前的问题：自动备份（keep 5）与 corrupt-backup 只存在于磁盘上，
 * 应用里没有任何入口能看到它们、更无法恢复；用户唯一的兜底是「手动导出 JSON」，
 * 而导出的是一个必须自己找地方存的文件 —— 对「本地优先、无账号」的产品来说等于没有兜底。
 */

const FILE_NAME = 'blockhabit.json'
export const AUTO_PREFIX = 'blockhabit-backup-'
export const MANUAL_PREFIX = 'blockhabit-manual-'
export const CORRUPT_NAME = `${FILE_NAME}.corrupt-backup`
/** 手动快照保留数量（自动备份另有自己的 5 份保留策略，互不挤占） */
const MANUAL_KEEP = 5

export type BackupKind = 'auto' | 'manual' | 'corrupt'

export interface BackupEntry {
  /** 文件名（恢复时作为定位依据） */
  name: string
  kind: BackupKind
  /** 从文件名解析出的时间戳（毫秒）；解析不出时为 null */
  timestamp: number | null
  /** 字节数；stat 失败时为 0 */
  size: number
}

function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function dataDir(): Promise<string> {
  const { appDataDir } = await import('@tauri-apps/api/path')
  return appDataDir()
}

/** 从 `blockhabit-backup-2026-11-10T03-40-12-345Z.json` 解析时间戳 */
export function parseStamp(name: string, prefix: string): number | null {
  if (!name.startsWith(prefix)) return null
  const core = name.slice(prefix.length).replace(/\.json$/, '')
  const m = core.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, ms] = m
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, +ms)
}

export function kindOfName(name: string): BackupKind | null {
  if (name === CORRUPT_NAME) return 'corrupt'
  if (name.startsWith(AUTO_PREFIX)) return 'auto'
  if (name.startsWith(MANUAL_PREFIX)) return 'manual'
  return null
}

/**
 * 列出应用数据目录里的可恢复备份（新→旧）。
 * 非桌面环境返回空数组：浏览器端状态在 localStorage，没有磁盘备份的概念。
 */
export async function listBackups(): Promise<BackupEntry[]> {
  if (!isDesktop()) return []
  try {
    const { readDir, stat } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const dir = await dataDir()
    const entries = await readDir(dir)
    const out: BackupEntry[] = []
    for (const entry of entries) {
      const name = entry.name
      if (typeof name !== 'string') continue
      const kind = kindOfName(name)
      if (!kind) continue
      let size = 0
      try {
        const info = await stat(await join(dir, name))
        size = typeof info.size === 'number' ? info.size : 0
      } catch {
        size = 0
      }
      const prefix = kind === 'manual' ? MANUAL_PREFIX : AUTO_PREFIX
      out.push({
        name,
        kind,
        timestamp: kind === 'corrupt' ? null : parseStamp(name, prefix),
        size
      })
    }
    // 新的在前；corrupt-backup 没有时间戳，排最后
    out.sort((a, b) => (b.timestamp ?? -1) - (a.timestamp ?? -1))
    return out
  } catch {
    return []
  }
}

/** 读取并严格校验一个备份（v1 旧档先迁移），失败返回 null */
export async function readBackup(name: string): Promise<AppState | null> {
  if (!isDesktop()) return null
  try {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const text = await readTextFile(await join(await dataDir(), name))
    return prepareImport(JSON.parse(text))
  } catch {
    return null
  }
}

/** 立即创建一份手动快照（保留最近 MANUAL_KEEP 份） */
export async function createBackup(state: AppState): Promise<boolean> {
  if (!isDesktop()) return false
  try {
    const { writeTextFile, readDir, remove } = await import('@tauri-apps/plugin-fs')
    const { join } = await import('@tauri-apps/api/path')
    const dir = await dataDir()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await writeTextFile(await join(dir, `${MANUAL_PREFIX}${stamp}.json`), JSON.stringify(state))
    const names = (await readDir(dir))
      .map((e) => e.name)
      .filter((n): n is string => typeof n === 'string' && n.startsWith(MANUAL_PREFIX))
      .sort()
    while (names.length > MANUAL_KEEP) {
      const oldest = names.shift()
      if (oldest) await remove(await join(dir, oldest))
    }
    return true
  } catch {
    return false
  }
}

/** 用系统文件管理器打开数据目录（本地优先：不联网、不上传） */
export async function openDataDir(): Promise<boolean> {
  if (!isDesktop()) return false
  try {
    // Wave 0：openPath 需要 capabilities 里的 opener:allow-open-path（未授权会静默失败）；
    // revealItemInDir 在 opener:default 内，用它打开数据目录更可靠。
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
    await revealItemInDir(await dataDir())
    return true
  } catch {
    return false
  }
}
