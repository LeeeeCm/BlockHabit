import type { AppState } from '../types'
import { SCHEMA_VERSION, loadAndMigrate, type LoadResult, type StorageAdapter } from './adapter'

const FILE_NAME = 'blockhabit.json'
const BACKUP_PREFIX = 'blockhabit-backup-'
const BACKUP_KEEP = 5

/** 临时文件序号：并发写时保证每笔写各用各的 tmp，避免互相截断 */
let tmpSeq = 0

async function statePath(): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path')
  const dir = await appDataDir()
  return join(dir, FILE_NAME)
}

/** Tauri 桌面端：状态存 appDataDir/blockhabit.json，损坏时备份后重置 */
export function createTauriStorageAdapter(): StorageAdapter {
  return {
    async load(): Promise<LoadResult> {
      const { exists, readTextFile } = await import('@tauri-apps/plugin-fs')
      let path: string
      try {
        path = await statePath()
      } catch (e) {
        return { state: null, loadFailed: true, detail: String(e) }
      }
      let present: boolean
      try {
        present = await exists(path)
      } catch (e) {
        // 连「文件是否存在」都问不出来（权限/路径问题）：按读取失败处理
        return { state: null, loadFailed: true, detail: String(e) }
      }
      if (!present) return { state: null }

      let raw: string
      try {
        raw = await readTextFile(path)
      } catch (e) {
        // 文件存在但读不出来（被占用 / 权限 / IO 错误）：绝不能当成「没有存档」
        return { state: null, loadFailed: true, detail: String(e) }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        await backupCorrupt(path, raw)
        return { state: null, corruptRecovered: true }
      }
      try {
        const migrated = loadAndMigrate(parsed)
        if (migrated.state) return { state: migrated.state }
        // needsUpgrade：来自更新版本应用的合法存档，不能当损坏覆盖
        if (!migrated.needsUpgrade) await backupCorrupt(path, raw)
        return { state: null, needsUpgrade: migrated.needsUpgrade }
      } catch (e) {
        // 迁移/清洗崩溃：原文已备份，标记读取失败以挂起持久化
        await backupCorrupt(path, raw)
        return { state: null, loadFailed: true, detail: String(e) }
      }
    },

    async save(state: AppState): Promise<void> {
      // Platform-specific Tauri plugin: dynamically imported to avoid crashing in browser / web environments
      const { mkdir, writeTextFile, rename } = await import('@tauri-apps/plugin-fs')
      const { appDataDir } = await import('@tauri-apps/api/path')
      const dir = await appDataDir()
      await mkdir(dir, { recursive: true })
      const path = await statePath()
      // 唯一临时文件名：并发写时两笔写不会共用同一个 tmp 互相截断
      const tmpPath = `${path}.${++tmpSeq}.tmp`
      const json = JSON.stringify(state)
      // 先写入临时文件，再原子重命名替换，防止进程中断或系统断电导致主存档被截断或损毁
      await writeTextFile(tmpPath, json)
      try {
        await rename(tmpPath, path)
      } catch (err) {
        // 不再回退「直接覆盖主档」：该回退是非原子写，可能留下半截 JSON。
        // 保留 tmp（其中是最新完整状态，便于人工恢复）并抛出，由持久化层置 saveError 提示用户。
        throw err
      }
      // 失败直接抛出（磁盘满/杀软锁定等），由持久化层捕获后上报 UI
    },

    async backup(state: AppState): Promise<void> {
      try {
        const { writeTextFile, readDir, remove } = await import('@tauri-apps/plugin-fs')
        const { appDataDir, join } = await import('@tauri-apps/api/path')
        const dir = await appDataDir()
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        await writeTextFile(await join(dir, `${BACKUP_PREFIX}${stamp}.json`), JSON.stringify(state))
        const entries = await readDir(dir)
        const names = entries
          .map((e) => e.name)
          .filter((n): n is string => typeof n === 'string' && n.startsWith(BACKUP_PREFIX))
          .sort()
        while (names.length > BACKUP_KEEP) {
          const oldest = names.shift()
          if (oldest) await remove(await join(dir, oldest))
        }
      } catch {
        // 备份失败不阻塞导入
      }
    }
  }
}

async function backupCorrupt(path: string, raw: string): Promise<void> {
  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(`${path}.corrupt-backup`, raw)
  } catch {
    // 备份失败不阻塞启动
  }
}

export { SCHEMA_VERSION }
