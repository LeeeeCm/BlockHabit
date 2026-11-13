export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

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
  rememberPassword: true,
}