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
}
