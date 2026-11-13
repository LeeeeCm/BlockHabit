import { useState, useCallback, useEffect, useRef } from 'react'
import { persistenceReady, useAppStore } from '../store/appStore'
import { prepareImport } from '../storage/adapter'
import type { AppState } from '../types'
import { DEFAULT_WEBDAV_CONFIG, type SyncStatus, type WebDavConfig } from './types'
import { fetchRemoteState, pushRemoteState, WebDavError } from './webdav'
import { mergeAppState } from './merge'
import { serializeState } from '../store/serializeState'
import {
  credentialAccount,
  getCredential,
  isOsCredentialStoreReady,
  probeCredentialStore,
  removeCredential,
  setCredential,
} from '../platform/credentials'

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

/**
 * B1：实际落盘的配置。
 * rememberPassword=false 时绝不把密码写进 localStorage（密码只留在内存），
 * 避免"关了开关但密码还在磁盘上"的假安全。
 */
/**
 * B1：实际落盘的配置。
 * rememberPassword=false 时绝不把密码写进 localStorage（密码只留在内存），
 * 避免「关了开关但密码还在磁盘上」的假安全。
 *
 * C4 §4 方案 B：OS 凭据存储可用时，密码交给凭据管理器，localStorage 只留 credentialStore 标记；
 * 存储不可用（浏览器预览 / 企业策略禁用凭据管理器）时退回旧行为，密码随配置落盘。
 */
export function persistableWebDavConfig(config: WebDavConfig): WebDavConfig {
  if (config.rememberPassword === false) {
    return { ...config, password: '', credentialStore: undefined }
  }
  if (isOsCredentialStoreReady()) return { ...config, password: '', credentialStore: 'os' }
  return { ...config, credentialStore: undefined }
}

export function loadWebDavConfig(): WebDavConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_WEBDAV_CONFIG }
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WEBDAV_CONFIG }
    const merged: WebDavConfig = { ...DEFAULT_WEBDAV_CONFIG, ...JSON.parse(raw) }
    // 旧配置可能遗留密码但已显式关闭记住：读取时同样丢弃，不把密码带进内存之外的任何地方
    if (merged.rememberPassword === false) {
      return { ...merged, password: '', credentialStore: undefined }
    }
    return merged
  } catch {
    return { ...DEFAULT_WEBDAV_CONFIG }
  }
}

/** 只写 localStorage（不含密码时也写标记）；不碰凭据管理器，供迁移内部复用避免递归 */
function writeConfigStorage(config: WebDavConfig): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(persistableWebDavConfig(config)))
  } catch (err) {
    console.error('Failed to save WebDAV config', err)
  }
}

export function saveWebDavConfig(config: WebDavConfig): void {
  if (typeof localStorage === 'undefined') return
  writeConfigStorage(config)
  // 密码的去处与配置分开：这里 async 收尾，绝不阻塞配置落盘
  void persistWebDavSecret(config)
}

/** 把密码同步到「该去的地方」：关闭记住 → 删除；存储可用 → 写 OS；否则留在 localStorage（旧行为） */
async function persistWebDavSecret(config: WebDavConfig): Promise<void> {
  if (config.rememberPassword === false) {
    await dropWebDavSecret(config)
    return
  }
  if (!isOsCredentialStoreReady()) return
  try {
    const account = await credentialAccount(config.endpoint, config.username)
    if (config.password) await setCredential(account, config.password)
    else await removeCredential(account)
  } catch {
    // 写入失败不打断保存；下次启动的迁移会再试一次，密码仍以调用方内存为准
  }
}

/** 删除与当前端点/用户名对应的凭据（关闭「记住密码」或清空配置时调用） */
async function dropWebDavSecret(config: WebDavConfig): Promise<void> {
  if (!isOsCredentialStoreReady()) return
  if (!config.endpoint && !config.username) return
  try {
    await removeCredential(await credentialAccount(config.endpoint, config.username))
  } catch {
    // 删除失败不影响功能：最坏情况是凭据管理器里残留一条读不到的旧密码
  }
}

/**
 * C4 §4 方案 B 的探测 / 迁移 / 回填（启动时调用一次）：
 * 1) 探测 OS 凭据存储；不可用则什么都不做，完全保持旧行为。
 * 2) rememberPassword=false：磁盘与凭据管理器里都不该有密码 → 清掉后返回。
 * 3) 老存档里有明文密码：搬进凭据管理器，成功后立刻把 localStorage 里的明文清掉（隐私优先）。
 * 4) credentialStore === 'os'：从凭据管理器取回密码，重开应用仍能自动同步。
 * 任何一步失败都保持原样返回（不破坏可用性），下次启动重试。
 */
export async function hydrateWebDavCredentials(config: WebDavConfig): Promise<WebDavConfig> {
  if (typeof localStorage === 'undefined') return config
  const available = await probeCredentialStore()
  if (!available) return config

  const account = await credentialAccount(config.endpoint, config.username)

  if (config.rememberPassword === false) {
    if (!config.password && config.credentialStore !== 'os') return config
    await removeCredential(account)
    const cleared: WebDavConfig = { ...config, password: '', credentialStore: undefined }
    writeConfigStorage(cleared)
    return cleared
  }

  // 迁移：把明文字段搬进凭据管理器
  if (config.password) {
    const stored = await setCredential(account, config.password)
    if (!stored) return config
    const migrated: WebDavConfig = { ...config, credentialStore: 'os' }
    writeConfigStorage(migrated)
    return migrated
  }

  // 回填：本地只留标记，真正的密码在凭据管理器里
  if (config.credentialStore === 'os') {
    const secret = await getCredential(account)
    if (secret) return { ...config, password: secret }
  }
  return config
}

function buildLocalState(): AppState {
  return serializeState(useAppStore.getState())
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
  // B1：关闭"记住密码"时立即落盘（而不是等防抖），确保磁盘上的旧密码马上被清掉。
  const updateConfig = useCallback((patch: Partial<WebDavConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch }
      if (typeof window !== 'undefined') {
        window.clearTimeout(configSaveTimer.current)
        if (patch.rememberPassword === false) {
          saveWebDavConfig(next)
        } else {
          configSaveTimer.current = window.setTimeout(() => saveWebDavConfig(next), 800)
        }
      }
      return next
    })
  }, [])

  // C4 §4 方案 B：挂载即探测 / 迁移 / 回填（异步，不阻塞首屏；失败保持原样）
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const current = configRef.current
      const next = await hydrateWebDavCredentials(current)
      if (!cancelled && next !== current) setConfigState(next)
    })()
    return () => {
      cancelled = true
    }
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

    // 密码可能只在凭据管理器里（credentialStore='os'）：同步前先回填，避免用空密码打服务器
    let currentConfig = configRef.current
    if (currentConfig.credentialStore === 'os' && !currentConfig.password) {
      const hydrated = await hydrateWebDavCredentials(currentConfig)
      if (hydrated !== currentConfig) {
        setConfigState(hydrated)
        currentConfig = hydrated
      }
    }
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