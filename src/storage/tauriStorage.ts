import type { AppState } from '../types'
import { SCHEMA_VERSION, loadAndMigrate, type LoadResult, type StorageAdapter } from './adapter'

const FILE_NAME = 'blockhabit.json'
const BACKUP_PREFIX = 'blockhabit-backup-'
const BACKUP_KEEP = 5

async function statePath(): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path')
  const dir = await appDataDir()
  return join(dir, FILE_NAME)
}

/** Tauri 桌面端：状态存 appDataDir/blockhabit.json，损坏时备份后重置 */
export function createTauriStorageAdapter(): StorageAdapter {
  return {
    async load(): Promise<LoadResult> {
      try {
        const { exists, readTextFile } = await import('@tauri-apps/plugin-fs')
        const path = await statePath()
        if (!(await exists(path))) return { state: null }
        const raw = await readTextFile(path)
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          await backupCorrupt(path, raw)
          return { state: null }
        }
        const migrated = loadAndMigrate(parsed)
        if (migrated.state) return { state: migrated.state }
        // needsUpgrade：来自更新版本应用的合法存档，不能当损坏覆盖
        if (!migrated.needsUpgrade) await backupCorrupt(path, raw)
        return { state: null, needsUpgrade: migrated.needsUpgrade }
      } catch {
        return { state: null }
      }
    },

    async save(state: AppState): Promise<void> {
      // Platform-specific Tauri plugin: dynamically imported to avoid crashing in browser / web environments
      const { mkdir, writeTextFile, rename } = await import('@tauri-apps/plugin-fs')
      const { appDataDir } = await import('@tauri-apps/api/path')
      const dir = await appDataDir()
      await mkdir(dir, { recursive: true })
      const path = await statePath()
      const tmpPath = `${path}.tmp`
      const json = JSON.stringify(state)
      // 先写入临时文件，再原子重命名替换，防止进程中断或系统断电导致主存档被截断或损毁
      await writeTextFile(tmpPath, json)
      try {
        await rename(tmpPath, path)
      } catch {
        try {
          await writeTextFile(path, json)
        } finally {
          try {
            const { remove } = await import('@tauri-apps/plugin-fs')
            await remove(tmpPath)
          } catch {
            // tmp 已不存在或删除失败均无碍
          }
        }
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
    },
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
