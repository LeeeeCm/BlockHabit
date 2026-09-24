import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'
import { isValidState } from '../storage/adapter'
import type { AppState } from '../types'
import { DEFAULT_WEBDAV_CONFIG, type SyncStatus, type WebDavConfig } from './types'
import { fetchRemoteState, pushRemoteState } from './webdav'
import { mergeAppState } from './merge'

const CONFIG_STORAGE_KEY = 'blockhabit_webdav_config'

export function loadWebDavConfig(): WebDavConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_WEBDAV_CONFIG }
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WEBDAV_CONFIG }
    return { ...DEFAULT_WEBDAV_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_WEBDAV_CONFIG }
  }
}

export function saveWebDavConfig(config: WebDavConfig): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch (err) {
    console.error('Failed to save WebDAV config', err)
  }
}

export function useSync() {
  const [config, setConfigState] = useState<WebDavConfig>(loadWebDavConfig)
  const [isSyncing, setIsSyncing] = useState(false)
  const [status, setStatus] = useState<SyncStatus>(() => config.lastSyncStatus ?? 'idle')
  const [error, setError] = useState<string | null>(() => config.lastSyncError ?? null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => config.lastSyncAt ?? null)

  const configRef = useRef(config)
  configRef.current = config

  const updateConfig = useCallback((patch: Partial<WebDavConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch }
      saveWebDavConfig(next)
      return next
    })
  }, [])

  const syncNow = useCallback(async (): Promise<boolean> => {
    const currentConfig = configRef.current
    const endpoint = currentConfig.endpoint.trim()

    if (!endpoint) {
      const errMsg = '请先填写 WebDAV 服务器地址'
      setError(errMsg)
      setStatus('error')
      return false
    }

    setIsSyncing(true)
    setStatus('syncing')
    setError(null)

    try {
      const remoteJson = await fetchRemoteState(currentConfig)
      const store = useAppStore.getState()
      const localState: AppState = {
        schemaVersion: 1,
        habits: store.habits,
        checkIns: store.checkIns,
        builds: store.builds,
        activeBlueprintId: store.activeBlueprintId,
        completedBlueprintIds: store.completedBlueprintIds,
        settings: store.settings,
        dayClaims: store.dayClaims,
        repairBricks: store.repairBricks,
        showcasePlacements: store.showcasePlacements,
        foundationNotes: store.foundationNotes,
      }

      let finalState = localState

      if (remoteJson !== null) {
        let parsedRemote: unknown
        try {
          parsedRemote = JSON.parse(remoteJson)
        } catch {
          throw new Error('远程存档 JSON 解析失败')
        }

        if (!isValidState(parsedRemote)) {
          throw new Error('远程存档数据结构不兼容')
        }

        finalState = mergeAppState(localState, parsedRemote)
        store.importData(JSON.stringify(finalState))
      }

      await pushRemoteState(currentConfig, JSON.stringify(finalState, null, 2))

      const now = new Date().toISOString()
      const updatedConfig: WebDavConfig = {
        ...currentConfig,
        lastSyncAt: now,
        lastSyncStatus: 'success',
        lastSyncError: null,
      }
      setConfigState(updatedConfig)
      saveWebDavConfig(updatedConfig)
      setLastSyncAt(now)
      setStatus('success')
      setIsSyncing(false)
      return true
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const updatedConfig: WebDavConfig = {
        ...currentConfig,
        lastSyncStatus: 'error',
        lastSyncError: errMsg,
      }
      setConfigState(updatedConfig)
      saveWebDavConfig(updatedConfig)
      setError(errMsg)
      setStatus('error')
      setIsSyncing(false)
      return false
    }
  }, [])

  // Auto-sync interval if enabled and interval > 0
  useEffect(() => {
    if (!config.enabled || !config.endpoint) return
    const intervalMins = config.autoSyncIntervalMinutes ?? 30
    if (intervalMins <= 0) return

    const intervalMs = intervalMins * 60 * 1000
    const timer = setInterval(() => {
      void syncNow()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [config.enabled, config.endpoint, config.autoSyncIntervalMinutes, syncNow])

  return {
    config,
    updateConfig,
    isSyncing,
    status,
    error,
    lastSyncAt,
    syncNow,
  }
}
