import { createContext, useContext, type ReactNode } from 'react'
import { useSync } from './useSync'
import type { SyncController } from './types'

/**
 * 应用级同步控制器（D-20261115-074）。
 *
 * 为什么需要它：`useSync()` 里挂着「启动同步 / 定时同步 / keyring 迁移回填」三组 effect，
 * 而它原本只被 `SettingsDialog` 调用、设置对话框又只在 `settingsOpen` 时挂载——
 * 结果是**不打开设置页就永远不会自动同步**（详见 design/records/D-20261115-074）。
 *
 * 现在由本 Provider 在应用级持有唯一的 `useSync()` 实例，设置页只做消费者：
 * - 主窗口挂载（`src/main.tsx`）；托盘菜单窗口**不挂**，避免两个窗口并发写同一份远端；
 * - 同步状态跨设置页开关存活（关掉再开不会重置成磁盘里的旧状态）；
 * - 同步逻辑本身零改动（`useSync` 一行没动），改动只是把挂载点从弹窗上移到应用。
 */
const SyncContext = createContext<SyncController | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const sync = useSync()
  return <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
}

/**
 * 读取应用级同步控制器。必须在 `<SyncProvider>` 内使用。
 * 故意在缺失时抛错而不是静默降级：静默降级会重新引入「把 hook 塞回某个弹窗里」的回归。
 */
export function useSyncController(): SyncController {
  const value = useContext(SyncContext)
  if (!value) {
    throw new Error('useSyncController 必须在 <SyncProvider> 内使用（见 D-20261115-074）')
  }
  return value
}
