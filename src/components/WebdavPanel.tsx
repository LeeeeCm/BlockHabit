import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import {
  PROVIDER_ORDER,
  PROVIDER_PRESETS,
  buildEndpoint,
  normalizeServerBase,
  type ProviderId
} from '../sync/providers'
import {
  createFetchTransport,
  runWebDavDiagnosis,
  sanitizeDiagnosticDetail,
  type DiagnoseResult,
  type DiagnoseStage
} from '../sync/diagnose'
import { httpFetch, isTauriRuntime } from '../platform/http'

/**
 * 同步控制器的形状定义已上移到 `src/sync/types.ts`（D-20261115-074：
 * 同步层不该反向依赖组件文件），这里 re-export 保持既有导入与测试可用。
 *
 * 历史：本接口原本描述「SettingsDialog 里 useSync() 的返回值」；现在控制器由
 * `<SyncProvider>` 在应用级持有，设置页只是消费者，语义比原来更强。
 */
import type { SyncController } from '../sync/types'

export type { SyncController }

/** 从已有 endpoint 推断服务商（仅用于设置页首次展开时的预设高亮） */
function detectProvider(endpoint: string): ProviderId {
  if (endpoint.includes('jianguoyun.com')) return 'jianguoyun'
  if (endpoint.includes('/remote.php/dav/')) return 'nextcloud'
  if (endpoint.includes('/home/BlockHabit')) return 'synology'
  return 'generic'
}

/** 预设切换时从 endpoint 反推 base，避免把 /remote.php/dav/... 再拼一次 */
function baseFromEndpoint(endpoint: string): string {
  let value = endpoint.trim()
  for (const marker of ['/remote.php/dav/', '/home/BlockHabit', '/dav/BlockHabit']) {
    const index = value.indexOf(marker)
    if (index > 0) value = value.slice(0, index)
  }
  return normalizeServerBase(value)
}

interface Props {
  sync: SyncController
  /** 复用设置页的瞬时提示（toast 仍渲染在 SettingsDialog 根部，位置与拆分前一致） */
  onToast: (message: string, durationMs?: number) => void
}

/**
 * WebDAV 数据同步面板（D-20261110-061）。
 * 从 SettingsDialog 抽出以控制单文件行数：服务商预设、端点 / 用户名 / 密码、
 * 分步连接自检与诊断结果、自动同步与立即同步。同步 hook 与 toast 由父组件传入。
 */
export function WebdavPanel({ sync, onToast }: Props) {
  const { t } = useI18n()
  const {
    config: syncConfig,
    updateConfig: updateSyncConfig,
    isSyncing,
    status: syncStatus,
    error: syncError,
    lastSyncAt,
    syncNow,
    getLastError
  } = sync
  const [endpoint, setEndpoint] = useState(syncConfig.endpoint)
  const [username, setUsername] = useState(syncConfig.username)
  /**
   * B1：密码 DOM 缓解 —— 已保存的密码**永不回填进 input 的 value**。
   * 输入框默认为空（placeholder 提示「已保存；留空继续使用」），
   * 只有用户本次输入的新密码才会进入 DOM；诊断/同步用 passwordToUse 取的仍是内存中的凭据。
   */
  const [passwordInput, setPasswordInput] = useState('')
  const storedPassword = syncConfig.password
  /** 本次会话开始时的已保存密码：用户清空输入框时回退到它，而不是把密码改成空串 */
  const baselinePasswordRef = useRef(storedPassword)
  const [providerId, setProviderId] = useState<ProviderId>(() =>
    detectProvider(syncConfig.endpoint)
  )
  const [diagnosis, setDiagnosis] = useState<DiagnoseResult | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)
  const diagnoseAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setEndpoint(syncConfig.endpoint)
    setUsername(syncConfig.username)
  }, [syncConfig.endpoint, syncConfig.username])

  // B1：设置对话框关闭/组件卸载时中止仍在运行的自检，避免悬挂请求
  useEffect(() => () => diagnoseAbortRef.current?.abort(), [])

  /** 实际用于连接/同步的密码：本次输入优先，否则用已保存的凭据 */
  const passwordToUse = passwordInput || storedPassword

  /** 同步错误码 → 用户文案 */
  function syncErrorText(code: string | null): string | null {
    if (!code) return null
    const map: Record<string, string> = {
      'no-endpoint': t.settings.syncErrors.noEndpoint,
      auth: t.settings.syncErrors.auth,
      parse: t.settings.syncErrors.parse,
      incompatible: t.settings.syncErrors.incompatible,
      network: t.settings.syncErrors.network,
      cors: t.settings.syncErrors.cors,
      conflict: t.settings.syncErrors.conflict,
      'no-collection': t.settings.syncErrors.noCollection,
      http: t.settings.syncErrors.http
    }
    return map[code] ?? t.settings.syncErrors.network
  }

  async function handleSync() {
    const ok = await syncNow()
    if (ok) {
      onToast(t.settings.webdav.syncSuccess, 3000)
    } else {
      onToast(syncErrorText(getLastError()) ?? t.settings.webdav.syncFailed, 3000)
    }
  }

  /** D-20261110-061：切换服务商预设，按当前 base/username 重建 endpoint */
  function applyProvider(next: ProviderId) {
    setProviderId(next)
    setDiagnosis(null)
    const preset = PROVIDER_PRESETS[next]
    if (!preset.requiresServer) {
      const nextEndpoint = buildEndpoint(next, '', username)
      setEndpoint(nextEndpoint)
      updateSyncConfig({ endpoint: nextEndpoint })
      return
    }
    // 固定端点（如坚果云）切回需要自填服务器的预设：先清空，避免把旧 host 带过去
    if (endpoint.includes('jianguoyun.com')) {
      setEndpoint('')
      updateSyncConfig({ endpoint: '' })
      return
    }
    const base = next === 'generic' ? normalizeServerBase(endpoint) : baseFromEndpoint(endpoint)
    if (!base) return
    const nextEndpoint = buildEndpoint(next, base, username)
    setEndpoint(nextEndpoint)
    updateSyncConfig({ endpoint: nextEndpoint })
  }

  /** 分步连接自检：不触发同步合并，只做只读 + 临时文件读写删；可随时取消（B1） */
  async function runConnectionTest() {
    if (!isTauriRuntime()) {
      onToast(t.settings.webdav.browserTestHint, 3000)
      return
    }
    if (!endpoint.trim()) {
      onToast(t.settings.syncErrors.noEndpoint, 2400)
      return
    }
    const controller = new AbortController()
    diagnoseAbortRef.current = controller
    setDiagnosing(true)
    setDiagnosis(null)
    try {
      const result = await runWebDavDiagnosis({
        endpoint,
        username,
        password: passwordToUse,
        transport: createFetchTransport(httpFetch),
        signal: controller.signal
      })
      setDiagnosis(result)
      if (result.cancelled) {
        const cleanup = result.stages.find((stage) => stage.stage === 'cleanup')
        onToast(
          cleanup && !cleanup.ok
            ? t.settings.webdav.testCancelledCleanupFail
            : t.settings.webdav.testCancelled,
          3000
        )
      } else {
        onToast(result.ok ? t.settings.webdav.testSuccess : t.settings.webdav.testFail, 3000)
      }
    } catch {
      if (!controller.signal.aborted) onToast(t.settings.webdav.testFail, 2400)
    } finally {
      if (diagnoseAbortRef.current === controller) diagnoseAbortRef.current = null
      setDiagnosing(false)
    }
  }

  /** B1：取消正在运行的分步自检；取消后仍会尽力清理已创建的临时文件 */
  function cancelDiagnosis() {
    diagnoseAbortRef.current?.abort()
  }

  function clearCredentials() {
    setPasswordInput('')
    baselinePasswordRef.current = ''
    updateSyncConfig({ password: '' })
    setDiagnosis(null)
    onToast(t.settings.webdav.clearCredentials, 2400)
  }

  function stageLabel(stage: DiagnoseStage): string {
    switch (stage) {
      case 'address':
        return t.settings.webdav.stageAddress
      case 'connection':
        return t.settings.webdav.stageConnection
      case 'auth':
        return t.settings.webdav.stageAuth
      case 'readwrite':
        return t.settings.webdav.stageReadWrite
      default:
        return t.settings.webdav.stageCleanup
    }
  }

  function diagnosisHint(code: string | undefined): string | null {
    if (!code) return null
    if (code === 'auth' || code === 'forbidden') return t.settings.webdav.diagnoseAuthHint
    if (code === 'tls') return t.settings.webdav.diagnoseTlsHint
    if (code === 'not-found') return t.settings.webdav.diagnoseDirHint
    if (code === 'insecure-http') return t.settings.webdav.diagnoseHttpHint
    if (code === 'unreachable' || code === 'timeout') return t.settings.syncErrors.network
    if (code === 'quota' || code === 'method' || code === 'http') return t.settings.syncErrors.http
    return null
  }

  async function copyDiagnosis() {
    if (!diagnosis) return
    const lines = [
      `${t.settings.webdav.testButton}: ${diagnosis.ok ? t.settings.webdav.testSuccess : t.settings.webdav.testFail}`,
      `endpoint: ${sanitizeDiagnosticDetail(endpoint, [passwordToUse, username])}`,
      ...diagnosis.stages.map(
        (s) =>
          `${s.stage}: ${s.ok ? 'ok' : s.code}${s.status ? ` (${s.status})` : ''}${s.detail ? ` ${s.detail}` : ''}`
      )
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      onToast(t.settings.webdav.copiedToast, 2400)
    } catch {
      onToast(t.settings.webdav.testFail, 2400)
    }
  }
  return (
    <>
      {/* D-20261110-061：服务商预设 */}
      <div className="field" style={{ marginBottom: 10 }}>
        <label>{t.settings.webdav.providerLabel}</label>
        <div className="seg">
          {PROVIDER_ORDER.map((id) => {
            const label =
              id === 'nextcloud'
                ? t.settings.webdav.providerNextcloud
                : id === 'jianguoyun'
                  ? t.settings.webdav.providerJianguoyun
                  : id === 'synology'
                    ? t.settings.webdav.providerSynology
                    : t.settings.webdav.providerGeneric
            return (
              <button
                key={id}
                type="button"
                className={providerId === id ? 'active' : ''}
                onClick={() => applyProvider(id)}
              >
                {label}
              </button>
            )
          })}
        </div>
        {PROVIDER_PRESETS[providerId].requiresAppPassword && (
          <div
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'var(--ink-2)',
              marginTop: 4,
              lineHeight: 1.5
            }}
          >
            {t.settings.webdav.appPasswordHint}
          </div>
        )}
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>{t.settings.webdav.serverUrl}</label>
        <input
          type="text"
          placeholder="https://dav.example.com/sync/"
          value={endpoint}
          readOnly={!PROVIDER_PRESETS[providerId].requiresServer}
          onChange={(e) => {
            setEndpoint(e.target.value)
            updateSyncConfig({ endpoint: e.target.value })
          }}
          disabled={isSyncing}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label>{t.settings.webdav.username}</label>
          <input
            type="text"
            placeholder={t.settings.webdav.username}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              updateSyncConfig({ username: e.target.value })
            }}
            disabled={isSyncing}
          />
        </div>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label>{t.settings.webdav.password}</label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={
              storedPassword && !passwordInput
                ? t.settings.webdav.passwordStoredPlaceholder
                : t.settings.webdav.passwordPlaceholder
            }
            value={passwordInput}
            onChange={(e) => {
              const value = e.target.value
              setPasswordInput(value)
              // 清空输入框 = 回退到本次会话开始时的已保存密码，而不是把密码改成空串
              updateSyncConfig({ password: value === '' ? baselinePasswordRef.current : value })
            }}
            disabled={isSyncing || diagnosing}
            style={{
              border: '1.5px solid var(--line)',
              background: 'var(--bg)',
              padding: '9px 12px',
              borderRadius: 'var(--r-sm)',
              outline: 'none',
              width: '100%',
              color: 'var(--ink)'
            }}
          />
          {storedPassword && !passwordInput && (
            <div
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--ink-2)',
                marginTop: 3,
                lineHeight: 1.5
              }}
            >
              {t.settings.webdav.passwordKeepHint}
            </div>
          )}
        </div>
      </div>

      {/* B1：凭据落盘策略 —— 关闭后密码只留在本次运行内存，localStorage 不写密码 */}
      <div className="field" style={{ marginBottom: 10 }}>
        <label>{t.settings.webdav.rememberPassword}</label>
        <div className="seg">
          <button
            type="button"
            className={syncConfig.rememberPassword !== false ? 'active' : ''}
            disabled={isSyncing}
            onClick={() => updateSyncConfig({ rememberPassword: true })}
          >
            {t.settings.webdav.rememberPasswordOn}
          </button>
          <button
            type="button"
            className={syncConfig.rememberPassword === false ? 'active' : ''}
            disabled={isSyncing}
            onClick={() => updateSyncConfig({ rememberPassword: false })}
          >
            {t.settings.webdav.rememberPasswordOff}
          </button>
        </div>
        <div
          style={{
            fontSize: 'var(--fs-caption)',
            color: 'var(--ink-2)',
            marginTop: 3,
            lineHeight: 1.5
          }}
        >
          {syncConfig.rememberPassword === false
            ? t.settings.webdav.rememberPasswordHintOff
            : syncConfig.credentialStore === 'os'
              ? t.settings.webdav.rememberPasswordHintOs
              : t.settings.webdav.rememberPasswordHintOn}
        </div>
      </div>
      {/* D-20261110-061：独立测试连接 + 分步结果（不触发同步合并） */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <button
          className="btn ghost"
          style={{ flex: 1, padding: '7px 0' }}
          disabled={isSyncing || (!diagnosing && !endpoint.trim())}
          onClick={() => (diagnosing ? cancelDiagnosis() : void runConnectionTest())}
        >
          {diagnosing ? t.settings.webdav.cancelTest : t.settings.webdav.testButton}
        </button>
        <button
          className="btn ghost"
          style={{ flex: 1, padding: '7px 0' }}
          disabled={isSyncing || diagnosing || !(passwordInput || storedPassword)}
          onClick={clearCredentials}
        >
          {t.settings.webdav.clearCredentials}
        </button>
      </div>

      {diagnosis && (
        <div
          aria-live="polite"
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            padding: '8px 10px',
            marginBottom: 10,
            background: 'var(--surface)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 'var(--fs-small)',
              fontWeight: 600,
              color: diagnosis.ok && !diagnosis.cancelled ? 'var(--progress-green)' : 'var(--ink)'
            }}
          >
            <span>
              {diagnosis.cancelled
                ? t.settings.webdav.testCancelled
                : diagnosis.ok
                  ? t.settings.webdav.testSuccess
                  : t.settings.webdav.testFail}
            </span>
            <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>
              {Math.round(diagnosis.elapsedMs)} ms
            </span>
          </div>
          {diagnosis.stages.map((stage) => (
            <div
              key={stage.stage}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginTop: 4,
                fontSize: 'var(--fs-caption)',
                color: 'var(--ink-2)'
              }}
            >
              <span
                style={{ color: stage.ok ? 'var(--progress-green)' : 'var(--ink)', flexShrink: 0 }}
              >
                {stage.ok ? '✓' : '✕'}
              </span>
              <span style={{ flexShrink: 0, minWidth: 40 }}>{stageLabel(stage.stage)}</span>
              {!stage.ok && (
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {stage.detail || stage.code}
                </span>
              )}
            </div>
          ))}
          {diagnosis.cancelled &&
            (() => {
              const cleanup = diagnosis.stages.find((stage) => stage.stage === 'cleanup')
              return cleanup && !cleanup.ok ? (
                <div
                  style={{
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--ink-2)',
                    marginTop: 6,
                    lineHeight: 1.5
                  }}
                >
                  {t.settings.webdav.testCancelledCleanupFail}
                </div>
              ) : null
            })()}
          {!diagnosis.ok &&
            (() => {
              const hint = diagnosisHint(diagnosis.stages.find((stage) => !stage.ok)?.code)
              return hint ? (
                <div
                  style={{
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--ink-2)',
                    marginTop: 6,
                    lineHeight: 1.5
                  }}
                >
                  {hint}
                </div>
              ) : null
            })()}
          {!diagnosis.ok && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                className="btn ghost"
                style={{ padding: '3px 10px', fontSize: 'var(--fs-caption)' }}
                onClick={() => void copyDiagnosis()}
              >
                {t.settings.webdav.copyError}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 自动同步开关与间隔：接线 useSync 既有的启动/定时同步逻辑 */}
      <div className="field" style={{ marginBottom: 10 }}>
        <label>{t.settings.webdav.autoSync}</label>
        <div className="seg">
          <button
            type="button"
            className={syncConfig.enabled ? 'active' : ''}
            disabled={isSyncing || !endpoint.trim()}
            onClick={() => updateSyncConfig({ enabled: true })}
          >
            {t.settings.webdav.autoSyncOn}
          </button>
          <button
            type="button"
            className={!syncConfig.enabled ? 'active' : ''}
            disabled={isSyncing || !endpoint.trim()}
            onClick={() => updateSyncConfig({ enabled: false })}
          >
            {t.settings.webdav.autoSyncOff}
          </button>
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
          {syncConfig.enabled
            ? t.settings.webdav.autoSyncHintOn
            : t.settings.webdav.autoSyncHintOff}
        </div>
        {syncConfig.enabled && (
          <div className="seg" style={{ marginTop: 8 }}>
            {([15, 30, 60, 180] as const).map((mins) => (
              <button
                key={mins}
                type="button"
                className={(syncConfig.autoSyncIntervalMinutes ?? 30) === mins ? 'active' : ''}
                disabled={isSyncing}
                onClick={() => updateSyncConfig({ autoSyncIntervalMinutes: mins })}
              >
                {mins === 15
                  ? t.settings.webdav.interval15m
                  : mins === 30
                    ? t.settings.webdav.interval30m
                    : mins === 60
                      ? t.settings.webdav.interval1h
                      : t.settings.webdav.interval3h}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginTop: 4
        }}
      >
        <div
          style={{
            fontSize: 'var(--fs-caption)',
            color: syncStatus === 'error' ? 'var(--danger)' : 'var(--ink-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {isSyncing
            ? t.settings.webdav.syncing
            : syncError
              ? (syncErrorText(syncError) ?? syncError)
              : lastSyncAt
                ? `${t.settings.webdav.lastSync}${new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : t.settings.webdav.notSynced}
        </div>
        <button
          className="btn primary"
          onClick={() => void handleSync()}
          disabled={isSyncing || !endpoint.trim()}
          style={{ padding: '6px 16px', fontSize: 'var(--fs-body)', flexShrink: 0 }}
        >
          {isSyncing ? t.settings.webdav.syncingBtn : t.settings.webdav.syncNowBtn}
        </button>
      </div>
    </>
  )
}
