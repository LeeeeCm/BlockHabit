import { useState, useCallback, useEffect, useRef } from 'react'
import { persistenceReady, useAppStore } from '../store/appStore'
import { prepareImport } from '../storage/adapter'
import type { AppState } from '../types'
import { DEFAULT_WEBDAV_CONFIG, type SyncStatus, type WebDavConfig } from './types'
import { fetchRemoteState, pushRemoteState, WebDavError } from './webdav'
import { mergeAppState } from './merge'

const CONFIG_STORAGE_KEY = 'blockhabit_webdav_config'

export type SyncErrorCode = WebDavError['code'] | 'no-endpoint' | 'parse' | 'incompatible'

/** 同步流程内部错误（非 HTTP 层） */
class SyncFlowError extends Error {
  code: Exclude<SyncErrorCode, WebDavError['code']>
  constructor(code: 'no-endpoint' | 'parse' | 'incompatible') {
    super(code)
    this.code = code
  }
}

function toErrorCode(err: unknown): SyncErrorCode {
  if (err instanceof WebDavError) return err.code
  if (err instanceof SyncFlowError) return err.code
  return 'network'
}

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

function buildLocalState(): AppState {
  const store = useAppStore.getState()
  return {
    schemaVersion: 2,
    habits: store.habits,
    checkIns: store.checkIns,
    builds: store.builds,
    activeBlueprintId: store.activeBlueprintId,
    completedBlueprintIds: store.completedBlueprintIds,
    settings: store.settings,
    dayClaims: store.dayClaims,
    deletedDayClaims: store.deletedDayClaims ?? [],
    repairBricks: store.repairBricks,
    showcasePlacements: store.showcasePlacements,
    foundationNotes: store.foundationNotes,
  }
}

/** 拉取远端 → 迁移/校验为当前 schema；失败抛 SyncFlowError */
async function fetchPreparedRemote(config: WebDavConfig): Promise<{ state: AppState | null; etag: string | null }> {
  const remote = await fetchRemoteState(config)
  if (remote.json === null) return { state: null, etag: remote.etag }
  let parsed: unknown
  try {
    parsed = JSON.parse(remote.json)
  } catch {
    throw new SyncFlowError('parse')
  }
  const prepared = prepareImport(parsed)
  if (!prepared) throw new SyncFlowError('incompatible')
  return { state: prepared, etag: remote.etag }
}

export function useSync() {
  const [config, setConfigState] = useState<WebDavConfig>(loadWebDavConfig)
  const [isSyncing, setIsSyncing] = useState(false)
  const [status, setStatus] = useState<SyncStatus>(() => config.lastSyncStatus ?? 'idle')
  const [error, setError] = useState<SyncErrorCode | null>(
    () => (config.lastSyncError as SyncErrorCode) ?? null,
  )
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => config.lastSyncAt ?? null)

  const configRef = useRef(config)
  configRef.current = config
  const syncingRef = useRef(false)
  const lastErrorRef = useRef<SyncErrorCode | null>((config.lastSyncError as SyncErrorCode) ?? null)
  const configSaveTimer = useRef<number | undefined>(undefined)

  // 配置防抖落盘：WebDAV 表单逐键输入不立即写 localStorage（密码等敏感信息减少落盘频次）
  const updateConfig = useCallback((patch: Partial<WebDavConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch }
      if (typeof window !== 'undefined') {
        window.clearTimeout(configSaveTimer.current)
        configSaveTimer.current = window.setTimeout(() => saveWebDavConfig(next), 800)
      }
      return next
    })
  }, [])

  const applyError = useCallback((code: SyncErrorCode) => {
    const currentConfig = configRef.current
    const updatedConfig: WebDavConfig = {
      ...currentConfig,
      lastSyncStatus: 'error',
      lastSyncError: code,
    }
    setConfigState(updatedConfig)
    saveWebDavConfig(updatedConfig)
    lastErrorRef.current = code
    setError(code)
    setStatus('error')
  }, [])

  const syncNow = useCallback(async (): Promise<boolean> => {
    if (syncingRef.current) {
      return false
    }

    const currentConfig = configRef.current
    const endpoint = currentConfig.endpoint.trim()
    if (!endpoint) {
      lastErrorRef.current = 'no-endpoint'
      setError('no-endpoint')
      setStatus('error')
      return false
    }

    // 未完成磁盘加载前不同步（防内存空态覆盖云端）；存档来自更高版本时挂起同步。
    // hydrated=true 蕴含 initPersistence 已同步连续完成订阅注册，无需再 await persistenceReady。
    if (!useAppStore.getState().hydrated || useAppStore.getState().needsUpgrade) {
      return false
    }

    syncingRef.current = true
    setIsSyncing(true)
    setStatus('syncing')
    lastErrorRef.current = null
    setError(null)
    try {
      const remote = await fetchPreparedRemote(currentConfig)
      // 网络往返后现场读取 store：把"合并覆盖用户并发操作"的窗口从整个 RTT 缩小到合并瞬间
      let finalState = buildLocalState()
      if (remote.state) {
        finalState = mergeAppState(finalState, remote.state)
        useAppStore.getState().importData(JSON.stringify(finalState))
      }

      try {
        await pushRemoteState(currentConfig, JSON.stringify(finalState, null, 2), remote.etag)
      } catch (err) {
        if (!(err instanceof WebDavError && err.code === 'conflict')) throw err
        // 条件写失败（412）：远端已被其他设备更新 → 以当前 store 状态（含第一次合并结果）重新合并、再推一次
        const retry = await fetchPreparedRemote(currentConfig)
        let remerged = buildLocalState()
        if (retry.state) {
          remerged = mergeAppState(remerged, retry.state)
          useAppStore.getState().importData(JSON.stringify(remerged))
        }
        await pushRemoteState(currentConfig, JSON.stringify(remerged, null, 2), retry.etag)
        finalState = remerged
      }

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
      lastErrorRef.current = null
      return true
    } catch (err) {
      applyError(toErrorCode(err))
      return false
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
    }
  }, [applyError])

  // 启动即同步：启用同步且距上次同步超过间隔时，hydration 完成后延迟 2s 触发一次
  useEffect(() => {
    if (!config.enabled || !config.endpoint) return
    let cancelled = false
    void (async () => {
      await persistenceReady
      if (cancelled) return
      const intervalMins = config.autoSyncIntervalMinutes ?? 30
      if (intervalMins <= 0) return
      const last = config.lastSyncAt ? new Date(config.lastSyncAt).getTime() : 0
      if (Date.now() - last < intervalMins * 60_000) return
      await new Promise((r) => setTimeout(r, 2000))
      if (!cancelled) void syncNow()
    })()
    return () => {
      cancelled = true
    }
    // 仅挂载时判定一次，避免配置变更反复触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    isSyncing,
    status,
    error,
    lastSyncAt,
    updateConfig,
    syncNow,
    getLastError: () => lastErrorRef.current,
  }
}
