import type { AppState } from '../types'
import { SCHEMA_VERSION, isValidState, normalizeState, type StorageAdapter } from './adapter'

const FILE_NAME = 'blockhabit.json'

async function statePath(): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path')
  const dir = await appDataDir()
  return join(dir, FILE_NAME)
}

/** Tauri 桌面端：状态存 appDataDir/blockhabit.json，损坏时备份后重置 */
export function createTauriStorageAdapter(): StorageAdapter {
  return {
    async load(): Promise<AppState | null> {
      try {
        const { exists, readTextFile } = await import('@tauri-apps/plugin-fs')
        const path = await statePath()
        if (!(await exists(path))) return null
        const raw = await readTextFile(path)
        const parsed: unknown = JSON.parse(raw)
        if (isValidState(parsed)) return normalizeState(parsed)
        await backupCorrupt(path, raw)
        return null
      } catch {
        return null
      }
    },

    async save(state: AppState): Promise<void> {
      try {
        const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs')
        const { appDataDir } = await import('@tauri-apps/api/path')
        const dir = await appDataDir()
        await mkdir(dir, { recursive: true })
        const path = await statePath()
        await writeTextFile(path, JSON.stringify(state))
      } catch (err) {
        console.error('blockhabit: save failed', err)
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
