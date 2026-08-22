import { createLocalStorageAdapter, type StorageAdapter } from './adapter'
import { createTauriStorageAdapter } from './tauriStorage'

export { createLocalStorageAdapter, STATE_KEY, SCHEMA_VERSION } from './adapter'
export { createTauriStorageAdapter } from './tauriStorage'

/** Tauri 环境用 appData JSON 文件，浏览器回退 localStorage（tauriStorage 内部懒加载 tauri 模块） */
export function pickAdapter(): StorageAdapter {
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  return inTauri ? createTauriStorageAdapter() : createLocalStorageAdapter()
}
