import { useEffect, useRef, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import type { ReactNode } from 'react'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { prepareImport } from '../storage/adapter'
import { exportDiagnosticsPackage } from '../platform/diagnostics'
import { resetGuideTips } from '../platform/guideTips'
import { ensureNotifyPermission } from '../platform/notify'
import { createBackup, listBackups, openDataDir, readBackup, type BackupEntry } from '../storage/backups'
import { pickAdapter } from '../storage'
import type { AppState } from '../types'
import { IconClose, IconKeyboard, IconRepair } from './Icons'
import { triggerHaptic, usePlatform } from '../platform'
import { BottomSheet } from './BottomSheet'
import { ConfirmDialog } from './ConfirmDialog'
import { useDialogA11y } from './useDialogA11y'
import { useSync } from '../sync/useSync'
import { ArchiveExportPanel } from './ArchiveExportPanel'
import { PROVIDER_ORDER, PROVIDER_PRESETS, buildEndpoint, normalizeServerBase, type ProviderId } from '../sync/providers'
import {
  createFetchTransport,
  runWebDavDiagnosis,
  sanitizeDiagnosticDetail,
  type DiagnoseResult,
  type DiagnoseStage,
} from '../sync/diagnose'
import { httpFetch, isTauriRuntime } from '../platform/http'
import { MINI_SIZE_ORDER } from '../platform/miniWindow'
const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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
  onClose: () => void
}

/**
 * D4：设置分组容器。
 * 设置项从 19 个控件 / 3.6 屏收敛为「首屏三组 + 折叠的进阶组」：
 * collapsible 时标题行可点击（并支持 Enter / Space），展开态记在本地 state，不影响任何已保存设置。
 */
function Group({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="apple-group">
      <div
        className="apple-group-title"
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpen((v) => !v)
                }
              }
            : undefined
        }
        style={
          collapsible
            ? { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }
            : undefined
        }
      >
        <span>{title}</span>
        {collapsible && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              color: 'var(--ink-2)',
              transition: 'transform var(--dur-xs) var(--ease-default)',
              transform: open ? 'rotate(90deg)' : 'none',
            }}
          >
            ›
          </span>
        )}
      </div>
      {open && children}
    </div>
  )
}

export function SettingsDialog({ onClose }: Props) {
  const { lang, t } = useI18n()
  const { isMobile } = usePlatform()
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const theme = settings.theme
  const setTheme = useAppStore((s) => s.setTheme)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const exportData = useAppStore((s) => s.exportData)
  const importData = useAppStore((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)
  const habits = useAppStore((s) => s.habits)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const repairBricks = useAppStore((s) => s.repairBricks ?? 0)
  const muted = settings.soundMuted === true
  const volume = typeof settings.volume === 'number' ? settings.volume : 100
  const [msg, showMsg] = useTransient<string>(2400)
  /** 通过深度校验、待用户确认后覆盖导入的存档 */
  const [importCandidate, setImportCandidate] = useState<AppState | null>(null)
  /** F3：数据目录里的可恢复备份（桌面端才有） */
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [autostart, setAutostart] = useState<boolean | null>(null)
  useEffect(() => {
    if (!inTauri) return
    void (async () => {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart')
      setAutostart(await isEnabled())
    })()
  }, [])
  const {
    config: syncConfig,
    updateConfig: updateSyncConfig,
    isSyncing,
    status: syncStatus,
    error: syncError,
    lastSyncAt,
    syncNow,
    getLastError,
  } = useSync()
  const [endpoint, setEndpoint] = useState(syncConfig.endpoint)
  const [username, setUsername] = useState(syncConfig.username)
  const [password, setPassword] = useState(syncConfig.password)
  const [providerId, setProviderId] = useState<ProviderId>(() => detectProvider(syncConfig.endpoint))
  const [diagnosis, setDiagnosis] = useState<DiagnoseResult | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)

  useEffect(() => {
    setEndpoint(syncConfig.endpoint)
    setUsername(syncConfig.username)
    setPassword(syncConfig.password)
  }, [syncConfig.endpoint, syncConfig.username, syncConfig.password])

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
      http: t.settings.syncErrors.http,
    }
    return map[code] ?? t.settings.syncErrors.network
  }

  async function handleSync() {
    const ok = await syncNow()
    if (ok) {
      showMsg(t.settings.webdav.syncSuccess, 3000)
    } else {
      showMsg(syncErrorText(getLastError()) ?? t.settings.webdav.syncFailed, 3000)
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

  /** 分步连接自检：不触发同步合并，只做只读 + 临时文件读写删 */
  async function runConnectionTest() {
    if (!isTauriRuntime()) {
      showMsg(t.settings.webdav.browserTestHint, 3000)
      return
    }
    if (!endpoint.trim()) {
      showMsg(t.settings.syncErrors.noEndpoint, 2400)
      return
    }
    setDiagnosing(true)
    setDiagnosis(null)
    try {
      const result = await runWebDavDiagnosis({
        endpoint,
        username,
        password,
        transport: createFetchTransport(httpFetch),
      })
      setDiagnosis(result)
      showMsg(result.ok ? t.settings.webdav.testSuccess : t.settings.webdav.testFail, 3000)
    } catch {
      showMsg(t.settings.webdav.testFail, 2400)
    } finally {
      setDiagnosing(false)
    }
  }

  function clearCredentials() {
    setPassword('')
    updateSyncConfig({ password: '' })
    setDiagnosis(null)
    showMsg(t.settings.webdav.clearCredentials, 2400)
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
      `endpoint: ${sanitizeDiagnosticDetail(endpoint, [password, username])}`,
      ...diagnosis.stages.map((s) => `${s.stage}: ${s.ok ? 'ok' : s.code}${s.status ? ` (${s.status})` : ''}${s.detail ? ` ${s.detail}` : ''}`),
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      showMsg(t.settings.webdav.copiedToast, 2400)
    } catch {
      showMsg(t.settings.webdav.testFail, 2400)
    }
  }
  // 嵌套的导入确认弹窗打开时抑制本弹窗的 Esc/焦点管理
  const { ref: dialogRef } = useDialogA11y({ open: true, onClose, enabled: !importCandidate })

  // 打开设置时拉取一次备份列表（仅桌面端有磁盘备份）
  useEffect(() => {
    if (!inTauri) return
    void listBackups().then(setBackups)
  }, [])


  async function toggleAutostart() {
    if (!inTauri) return
    const { enable, disable } = await import('@tauri-apps/plugin-autostart')
    const next = !(autostart ?? false)
    if (next) await enable()
    else await disable()
    setAutostart(next)
  }

  function doExport() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `blockhabit-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport(file: File) {
    let candidate: AppState | null = null
    try {
      const text = await file.text()
      // prepareImport：v2 档严格校验；v1 旧档先迁移再校验（否则合法旧备份会被误判为损坏）
      candidate = prepareImport(JSON.parse(text))
    } catch {
      candidate = null
    }
    if (!candidate) {
      showMsg(t.settings.importFail, 2400)
      return
    }
    setImportCandidate(candidate)
  }

  async function confirmImport() {
    const candidate = importCandidate
    setImportCandidate(null)
    if (!candidate) return
    // 覆盖前自动备份当前数据（Tauri 写入 appDataDir 带时间戳备份；web 写 localStorage）
    try {
      const current = JSON.parse(useAppStore.getState().exportData())
      await pickAdapter().backup?.(current)
    } catch {
      // 备份失败不阻塞导入
    }
    const ok = importData(JSON.stringify(candidate))
    showMsg(ok ? t.settings.importSuccess : t.settings.importFail, 2400)
  }

                  /** 刷新备份列表（读目录失败时保持空列表，不打扰用户） */
  async function refreshBackups(): Promise<void> {
    setBackups(await listBackups())
  }
  async function doManualBackup(): Promise<void> {
    const ok = await createBackup(JSON.parse(useAppStore.getState().exportData()))
    showMsg(ok ? t.settings.backupCreated : t.settings.backupCreateFail, 0)
    if (ok) await refreshBackups()
  }
  async function doExportDiagnostics(): Promise<void> {
    const ok = await exportDiagnosticsPackage()
    showMsg(ok ? t.settings.diagnosticsToast : t.settings.diagnosticsFailToast, 2400)
  }

  async function doOpenDataDir(): Promise<void> {
    if (!(await openDataDir())) showMsg(t.settings.openDirFail, 2400)
  }
  /** 从备份恢复：读取并严格校验后，复用「导入确认」流程（覆盖前同样会自动留档） */
  async function doRestoreBackup(name: string): Promise<void> {
    const state = await readBackup(name)
    if (!state) {
      showMsg(t.settings.backupReadFail, 2400)
      return
    }
    setImportCandidate(state)
  }

  const footerContent = (
    <div className="dialog-footer" style={{ borderTop: 'none', padding: 0 }}>
      <button className="btn primary" onClick={onClose} style={{ padding: '7px 24px', width: isMobile ? '100%' : undefined }}>
        {t.common.complete}
      </button>
    </div>
  )

  const bodyContent = (
    <>
          {/* 1. 界面与感官偏好 */}
          <Group title={t.settings.groupPreferences}>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t.settings.languageLabel}</label>
              <div className="seg">
                <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')}>
                  {t.settings.langZh}
                </button>
                <button className={lang === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>
                  {t.settings.langEn}
                </button>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t.settings.themeLabel}</label>
              <div className="seg">
                <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>
                  {t.settings.themeLight}
                </button>
                <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>
                  {t.settings.themeDark}
                </button>
                <button className={theme === 'oat' ? 'active' : ''} onClick={() => setTheme('oat')}>
                  {t.settings.themeOat}
                </button>
                <button className={theme === 'fog' ? 'active' : ''} onClick={() => setTheme('fog')}>
                  {t.settings.themeFog}
                </button>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t.settings.reminderToggleLabel}</label>
              <div className="seg">
                <button
                  type="button"
                  className={settings.remindersEnabled !== false ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ remindersEnabled: true })
                  }}
                >
                  {t.settings.reminderToggleOn}
                </button>
                <button
                  type="button"
                  className={settings.remindersEnabled === false ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ remindersEnabled: false })
                  }}
                >
                  {t.settings.reminderToggleOff}
                </button>
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                {t.settings.reminderToggleHint}
              </div>
            </div>

            {/* D-20261110-055 晚间收尾提醒：默认关，首次打卡后由用户显式开启 */}
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>{t.eveningNudge.settingsTitle}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="seg" style={{ flex: '0 0 auto', minWidth: 192 }}>
                  <button
                    type="button"
                    style={{ whiteSpace: 'nowrap' }}
                    className={settings.eveningNudgeEnabled === true ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      updateSettings({ eveningNudgeEnabled: true })
                      void ensureNotifyPermission()
                    }}
                  >
                    {t.settings.reminderToggleOn}
                  </button>
                  <button
                    type="button"
                    style={{ whiteSpace: 'nowrap' }}
                    className={settings.eveningNudgeEnabled !== true ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      updateSettings({ eveningNudgeEnabled: false })
                    }}
                  >
                    {t.settings.reminderToggleOff}
                  </button>
                </div>
                <input
                  type="time"
                  value={settings.eveningNudgeTime ?? '21:00'}
                  disabled={settings.eveningNudgeEnabled !== true}
                  aria-label={t.eveningNudge.settingsTime}
                  onChange={(e) => updateSettings({ eveningNudgeTime: e.target.value })}
                  style={{
                    padding: '5px 9px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                    fontSize: 'var(--fs-small)',
                    fontFamily: 'inherit',
                    opacity: settings.eveningNudgeEnabled === true ? 1 : 0.45,
                  }}
                />
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>
                {t.eveningNudge.settingsDesc} · {t.eveningNudge.settingsTimeNote}
              </div>
            </div>
          </Group>

          <Group title={t.settings.soundGroupTitle} collapsible defaultOpen={false}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t.settings.soundLabel}</label>
              <div className="seg">
                <button
                  className={!muted ? 'active' : ''}
                  onClick={() => updateSettings({ soundMuted: false })}
                >
                  {t.settings.soundOn}
                </button>
                <button
                  className={muted ? 'active' : ''}
                  onClick={() => updateSettings({ soundMuted: true })}
                >
                  {t.settings.soundOff}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, opacity: muted ? 0.4 : 1 }}>
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', flexShrink: 0 }}>{t.settings.volumeLabel}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={volume}
                  disabled={muted}
                  aria-label={t.settings.volumeLabel}
                  onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: 'var(--ink)' }}
                />
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', width: 32, textAlign: 'right', flexShrink: 0 }}>{volume}</span>
              </div>
            </div>
          </Group>

          {/* 2. 感官与氛围体验 (Apple HIG Ambience Panel) */}
          <Group title={t.settings.labTitle} collapsible defaultOpen={false}>

            {/* 时段感知昼夜光照 */}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t.settings.ambientLightingLabel}</label>
              <div className="seg">
                <button
                  type="button"
                  className={settings.enableAmbientLighting !== false ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ enableAmbientLighting: true })
                  }}
                >
                  {t.settings.ambientLightingOn}
                </button>
                <button
                  type="button"
                  className={settings.enableAmbientLighting === false ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ enableAmbientLighting: false })
                  }}
                >
                  {t.settings.ambientLightingOff}
                </button>
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                {t.settings.ambientLightingHint}
              </div>
            </div>

            {/* 抗断卡温和风化机制 */}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t.settings.gentleDecayLabel}</label>
              <div className="seg">
                <button
                  type="button"
                  className={settings.enableGentleDecay !== false ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ enableGentleDecay: true })
                  }}
                >
                  {t.settings.gentleDecayOn}
                </button>
                <button
                  type="button"
                  className={settings.enableGentleDecay === false ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ enableGentleDecay: false })
                  }}
                >
                  {t.settings.gentleDecayOff}
                </button>
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                {t.settings.gentleDecayHint}
              </div>
            </div>

            {/* 建筑微生态彩蛋 */}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t.settings.ecoPropsLabel}</label>
              <div className="seg">
                <button
                  type="button"
                  className={settings.enableEcoProps !== false ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ enableEcoProps: true })
                  }}
                >
                  {t.settings.ecoPropsOn}
                </button>
                <button
                  type="button"
                  className={settings.enableEcoProps === false ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ enableEcoProps: false })
                  }}
                >
                  {t.settings.ecoPropsOff}
                </button>
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                {t.settings.ecoPropsHint}
              </div>
            </div>

            {/* 透视考古默认态：接线 Build 页会话内开关的初始值 */}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t.settings.xrayDefaultLabel}</label>
              <div className="seg">
                <button
                  type="button"
                  className={Boolean(settings.enableXRayInspection) ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ enableXRayInspection: true })
                  }}
                >
                  {t.settings.xrayDefaultOn}
                </button>
                <button
                  type="button"
                  className={!settings.enableXRayInspection ? 'active' : ''}
                  onClick={() => {
                    triggerHaptic('selection')
                    updateSettings({ enableXRayInspection: false })
                  }}
                >
                  {t.settings.xrayDefaultOff}
                </button>
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                {t.settings.xrayDefaultHint}
              </div>
            </div>

            {/* ASMR 敲击音色 */}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t.settings.soundMaterialLabel}</label>
              <div className="seg">
                {(['classic', 'walnut', 'crystal', 'metal'] as const).map((mat) => {
                  const labelMap = {
                    classic: t.settings.soundMatClassic,
                    walnut: t.settings.soundMatWalnut,
                    crystal: t.settings.soundMatCrystal,
                    metal: t.settings.soundMatMetal,
                  }
                  const active = (settings.soundMaterial ?? 'classic') === mat
                  return (
                    <button
                      key={mat}
                      type="button"
                      className={active ? 'active' : ''}
                      onClick={() => {
                        triggerHaptic('selection')
                        updateSettings({ soundMaterial: mat })
                      }}
                    >
                      {labelMap[mat]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 移动端专属陀螺仪开关 或 桌面端悬浮摆件开关 */}
            {isMobile ? (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{t.settings.gyroscopeLabel}</label>
                <div className="seg">
                  <button
                    type="button"
                    className={Boolean(settings.enableGyroscope) ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      updateSettings({ enableGyroscope: true })
                    }}
                  >
                    {t.settings.gyroscopeOn}
                  </button>
                  <button
                    type="button"
                    className={!settings.enableGyroscope ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      updateSettings({ enableGyroscope: false })
                    }}
                  >
                    {t.settings.gyroscopeOff}
                  </button>
                </div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                  {t.settings.gyroscopeHint}
                </div>
              </div>
            ) : (
              <>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{t.settings.miniWidgetLabel}</label>
                <div className="seg">
                  <button
                    type="button"
                    className={Boolean(settings.enableMiniWidget) ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      updateSettings({ enableMiniWidget: true })
                    }}
                  >
                    {t.settings.miniWidgetOn}
                  </button>
                  <button
                    type="button"
                    className={!settings.enableMiniWidget ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      updateSettings({ enableMiniWidget: false })
                    }}
                  >
                    {t.settings.miniWidgetOff}
                  </button>
                </div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                  {t.settings.miniWidgetHint}
                </div>
              </div>

              {/* D-20261110-059：三档尺寸 + 置顶 */}
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label>{t.settings.miniSizeLabel}</label>
                <div className="seg">
                  {MINI_SIZE_ORDER.map((size) => {
                    const label =
                      size === 'pocket'
                        ? t.settings.miniSizePocket
                        : size === 'display'
                          ? t.settings.miniSizeDisplay
                          : t.settings.miniSizeStandard
                    return (
                      <button
                        key={size}
                        type="button"
                        className={(settings.miniWidgetSize ?? 'standard') === size ? 'active' : ''}
                        onClick={() => {
                          triggerHaptic('selection')
                          updateSettings({ miniWidgetSize: size })
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                  {t.settings.miniSizeHint}
                </div>
              </div>

              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label>{t.settings.miniAlwaysOnTopLabel}</label>
                <div className="seg">
                  <button
                    type="button"
                    className={settings.miniWidgetAlwaysOnTop === true ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      updateSettings({ miniWidgetAlwaysOnTop: true })
                    }}
                  >
                    {t.settings.miniAlwaysOnTopOn}
                  </button>
                  <button
                    type="button"
                    className={settings.miniWidgetAlwaysOnTop !== true ? 'active' : ''}
                    onClick={() => {
                      triggerHaptic('selection')
                      updateSettings({ miniWidgetAlwaysOnTop: false })
                    }}
                  >
                    {t.settings.miniAlwaysOnTopOff}
                  </button>
                </div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 3 }}>
                  {t.settings.miniAlwaysOnTopHint}
                </div>
              </div>
              </>
            )}

            {/* F9 本地诊断包：崩溃日志 + 数据体量 + 帧率采样，纯本地生成 */}
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t.settings.diagnosticsLabel}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className="btn ghost"
                  style={{ padding: '7px 16px' }}
                  onClick={() => void doExportDiagnostics()}
                >
                  {t.settings.diagnosticsExport}
                </button>
                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                  {t.settings.diagnosticsHint}
                </span>
              </div>
            </div>

            {/* D-20261110-054 页面提示：清空已读，三页首访提示重新出现一次 */}
            <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
              <label>{t.guide.replayTitle}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn ghost"
                  style={{ padding: '7px 16px' }}
                  onClick={() => {
                    triggerHaptic('selection')
                    resetGuideTips()
                    showMsg(t.guide.replayToast, 2400)
                  }}
                >
                  {t.guide.replay}
                </button>
              </div>
            </div>
          </Group>

          {/* 2. 系统与常驻 */}
          {inTauri && (
            <Group title={t.settings.groupSystem} collapsible defaultOpen={false}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{t.settings.autostartLabel}</label>
                <div className="seg">
                  <button className={autostart === false ? 'active' : ''} disabled={autostart === null} onClick={() => void toggleAutostart()}>
                    {t.settings.autostartOff}
                  </button>
                  <button className={autostart === true ? 'active' : ''} disabled={autostart === null} onClick={() => void toggleAutostart()}>
                    {t.settings.autostartOn}
                  </button>
                </div>
                {settings.remindersEnabled !== false && autostart === false && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5 }}>
                    {t.settings.reminderAutostartHint}
                  </div>
                )}
              </div>
            </Group>
          )}

          {/* 3. 数据备份 */}
          <Group title={t.settings.groupData} collapsible defaultOpen={false}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t.settings.dataLabel}</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn ghost" onClick={doExport} style={{ flex: 1, padding: '7px 0' }}>
                  {t.settings.exportJson}
                </button>
                <button className="btn ghost" onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '7px 0' }}>
                  {t.settings.importJson}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void doImport(f)
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            {/* A4 一键档案包：文件夹（桌面）/ 单 ZIP（浏览器），可取消、失败清理 */}
            <ArchiveExportPanel />
          </Group>

          {/* 3.05 备份与恢复（桌面端）：可见、可恢复的本地备份 */}
          {inTauri && (
            <Group title={t.settings.backupsTitle} collapsible defaultOpen={false}>
              <div className="field" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn ghost" onClick={() => void doManualBackup()} style={{ flex: 1, padding: '7px 0' }}>
                    {t.settings.backupNow}
                  </button>
                  <button className="btn ghost" onClick={() => void doOpenDataDir()} style={{ flex: 1, padding: '7px 0' }}>
                    {t.settings.openDataDir}
                  </button>
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{t.settings.restoreLabel}</label>
                {backups.length === 0 ? (
                  <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>{t.settings.backupsEmpty}</div>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {backups.map((b) => (
                      <li
                        key={b.name}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}
                      >
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.kind === 'corrupt'
                            ? t.settings.backupKindCorrupt
                            : b.timestamp
                              ? new Date(b.timestamp).toLocaleString()
                              : b.name}
                          {b.size > 0 && b.kind !== 'corrupt' ? `  ·  ${Math.max(1, Math.round(b.size / 1024))} KB` : ''}
                        </span>
                        <span style={{ fontSize: 'var(--fs-caption)', padding: '1px 6px', borderRadius: 999, background: 'color-mix(in srgb, var(--ink) 7%, transparent)' }}>
                          {b.kind === 'auto'
                            ? t.settings.backupKindAuto
                            : b.kind === 'manual'
                              ? t.settings.backupKindManual
                              : t.settings.backupKindCorrupt}
                        </span>
                        <button className="btn ghost" style={{ padding: '3px 10px', fontSize: 'var(--fs-small)' }} onClick={() => void doRestoreBackup(b.name)}>
                          {t.settings.backupRestore}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Group>
          )}

          {/* 3.1 WebDAV 数据同步 */}
          <Group title={t.settings.webdav.groupTitle} collapsible>
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
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>
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
                  placeholder={t.settings.webdav.passwordPlaceholder}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    updateSyncConfig({ password: e.target.value })
                  }}
                  disabled={isSyncing}
                  style={{
                    border: '1.5px solid var(--line)',
                    background: 'var(--bg)',
                    padding: '9px 12px',
                    borderRadius: 'var(--r-sm)',
                    outline: 'none',
                    width: '100%',
                    color: 'var(--ink)',
                  }}
                />
              </div>
            </div>
            {/* D-20261110-061：独立测试连接 + 分步结果（不触发同步合并） */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button
                className="btn ghost"
                style={{ flex: 1, padding: '7px 0' }}
                disabled={isSyncing || diagnosing || !endpoint.trim()}
                onClick={() => void runConnectionTest()}
              >
                {diagnosing ? t.settings.webdav.testing : t.settings.webdav.testButton}
              </button>
              <button
                className="btn ghost"
                style={{ flex: 1, padding: '7px 0' }}
                disabled={isSyncing || !password}
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
                  background: 'var(--surface)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 'var(--fs-small)',
                    fontWeight: 600,
                    color: diagnosis.ok ? 'var(--progress-green)' : 'var(--ink)',
                  }}
                >
                  <span>{diagnosis.ok ? t.settings.webdav.testSuccess : t.settings.webdav.testFail}</span>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>{Math.round(diagnosis.elapsedMs)} ms</span>
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
                      color: 'var(--ink-2)',
                    }}
                  >
                    <span style={{ color: stage.ok ? 'var(--progress-green)' : 'var(--ink)', flexShrink: 0 }}>
                      {stage.ok ? '✓' : '✕'}
                    </span>
                    <span style={{ flexShrink: 0, minWidth: 40 }}>{stageLabel(stage.stage)}</span>
                    {!stage.ok && (
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stage.detail || stage.code}
                      </span>
                    )}
                  </div>
                ))}
                {!diagnosis.ok &&
                  (() => {
                    const hint = diagnosisHint(diagnosis.stages.find((stage) => !stage.ok)?.code)
                    return hint ? (
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
              <div style={{ fontSize: 'var(--fs-caption)', color: syncStatus === 'error' ? 'var(--danger)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          </Group>

          {/* 4. 自律资产统计与快捷键 */}
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line)',
              fontSize: 'var(--fs-body)',
              color: 'var(--ink)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{t.settings.assetSummaryTitle}</div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
                {t.settings.assetSummaryDetail(habits.filter((h) => !h.archivedAt).length, completed.length)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconRepair size={13} style={{ color: 'var(--accent)' }} />
                <span>{repairBricks} / 2</span>
              </div>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>{t.settings.repairInventory}</div>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              background: 'color-mix(in srgb, var(--ink) 4%, transparent)',
              borderRadius: 'var(--r-md)',
              fontSize: 'var(--fs-small)',
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconKeyboard size={14} />
              <span>{t.settings.shortcutsTitle}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>{t.settings.shortcutsDetail}</div>
          </div>

          <p style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', margin: '0', textAlign: 'center', opacity: 0.8 }}>
            {t.settings.slogan}
          </p>
    </>
  )

  if (isMobile) {
    return (
      <BottomSheet open={true} onClose={onClose} title={t.settings.title} footer={footerContent} escEnabled={!importCandidate}>
        {bodyContent}
        {msg && <div className="toast">{msg}</div>}
        {importCandidate && (
          <ConfirmDialog
            title={t.settings.importConfirmTitle}
            message={t.settings.importConfirmMsg(
              useAppStore.getState().habits.length,
              useAppStore.getState().checkIns.length,
            )}
            confirmLabel={t.common.confirm}
            cancelLabel={t.common.cancel}
            danger
            onCancel={() => setImportCandidate(null)}
            onConfirm={() => void confirmImport()}
          />
        )}
      </BottomSheet>
    )
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-labelledby="settings-dialog-title"
      aria-modal="true"
      tabIndex={-1}
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw' }}>
        <div className="dialog-header">
          <h3 id="settings-dialog-title">{t.settings.title}</h3>
          <button
            className="icon-btn"
            onClick={() => {
              triggerHaptic('light')
              onClose()
            }}
            title={t.common.close}
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="dialog-body">
          {bodyContent}
        </div>

        {footerContent}

        {msg && <div className="toast">{msg}</div>}
        {importCandidate && (
          <ConfirmDialog
            title={t.settings.importConfirmTitle}
            message={t.settings.importConfirmMsg(
              useAppStore.getState().habits.length,
              useAppStore.getState().checkIns.length,
            )}
            confirmLabel={t.common.confirm}
            cancelLabel={t.common.cancel}
            danger
            onCancel={() => setImportCandidate(null)}
            onConfirm={() => void confirmImport()}
          />
        )}
      </div>
    </div>
  )
}
