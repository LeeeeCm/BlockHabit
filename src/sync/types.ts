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