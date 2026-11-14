export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

/** 同步层错误码：UI 侧按 code 映射 i18n 文案（HTTP/网络层来自 webdav.ts） */
export type WebDavErrorCode = 'auth' | 'network' | 'conflict' | 'no-collection' | 'http' | 'cors'

/** 同步流程可能暴露给 UI 的全部错误码（HTTP 层 + 本地流程） */
export type SyncErrorCode = WebDavErrorCode | 'no-endpoint' | 'parse' | 'incompatible'

export interface WebDavConfig {
  endpoint: string
  username: string
  password: string
  enabled: boolean
  autoSyncIntervalMinutes?: number
  lastSyncAt?: string | null
  lastSyncStatus?: SyncStatus
  lastSyncError?: string | null
  /**
   * B1：是否在本机持久化密码（默认 true，兼容旧配置）。
   * 关闭时密码只保留在当前运行的内存中，localStorage 绝不写入密码。
   */
  rememberPassword?: boolean
  /**
   * C4 §4 方案 B：密码存放位置。
   * 'os' = 已交给 OS 凭据管理器（localStorage 里不再有明文密码）；
   * 缺省 = 旧行为（明文随配置落盘，只会在凭据管理器不可用时出现）。
   */
  credentialStore?: 'os'
}

export const DEFAULT_WEBDAV_CONFIG: WebDavConfig = {
  endpoint: '',
  username: '',
  password: '',
  enabled: false,
  autoSyncIntervalMinutes: 30,
  lastSyncAt: null,
  lastSyncStatus: 'idle',
  lastSyncError: null,
  rememberPassword: true
}

/**
 * 同步控制器：`useSync()` 的返回值形状。
 *
 * D-20261115-074：从 `components/WebdavPanel.tsx` 上移到 sync 层，
 * 让 `SyncProvider` 不必反向依赖组件文件；`WebdavPanel` 仍然 re-export 这个名字以保持既有导入可用。
 */
export interface SyncController {
  config: WebDavConfig
  updateConfig: (patch: Partial<WebDavConfig>) => void
  isSyncing: boolean
  status: SyncStatus
  error: SyncErrorCode | null
  lastSyncAt: string | null
  syncNow: () => Promise<boolean>
  getLastError: () => SyncErrorCode | null
}
