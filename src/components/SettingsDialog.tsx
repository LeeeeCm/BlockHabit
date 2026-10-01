import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { validateState } from '../storage/adapter'
import { pickAdapter } from '../storage'
import type { AppState } from '../types'
import { IconClose, IconKeyboard, IconRepair } from './Icons'
import { triggerHaptic, usePlatform } from '../platform'
import { BottomSheet } from './BottomSheet'
import { ConfirmDialog } from './ConfirmDialog'
import { useDialogA11y } from './useDialogA11y'
import { useSync } from '../sync/useSync'
const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

interface Props {
  onClose: () => void
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
  const [msg, setMsg] = useState<string | null>(null)
  /** 通过深度校验、待用户确认后覆盖导入的存档 */
  const [importCandidate, setImportCandidate] = useState<AppState | null>(null)
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
      conflict: t.settings.syncErrors.conflict,
      'no-collection': t.settings.syncErrors.noCollection,
      http: t.settings.syncErrors.http,
    }
    return map[code] ?? t.settings.syncErrors.network
  }

  async function handleSync() {
    const ok = await syncNow()
    if (ok) {
      setMsg(t.settings.webdav.syncSuccess)
    } else {
      setMsg(syncErrorText(getLastError()) ?? t.settings.webdav.syncFailed)
    }
    setTimeout(() => setMsg(null), 3000)
  }
  // 嵌套的导入确认弹窗打开时抑制本弹窗的 Esc/焦点管理
  const { ref: dialogRef } = useDialogA11y({ open: true, onClose, enabled: !importCandidate })


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
      const verdict = validateState(JSON.parse(text))
      if (verdict.ok) candidate = verdict.state
    } catch {
      candidate = null
    }
    if (!candidate) {
      setMsg(t.settings.importFail)
      setTimeout(() => setMsg(null), 2400)
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
    setMsg(ok ? t.settings.importSuccess : t.settings.importFail)
    setTimeout(() => setMsg(null), 2400)
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
          <div className="apple-group">
            <div className="apple-group-title">{t.settings.groupPreferences}</div>

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
                <span style={{ fontSize: 11, color: 'var(--ink-2)', flexShrink: 0 }}>{t.settings.volumeLabel}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={volume}
                  disabled={muted}
                  onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: 11, color: 'var(--ink-2)', width: 32, textAlign: 'right', flexShrink: 0 }}>{volume}</span>
              </div>
            </div>
          </div>

          {/* 2. 感官与氛围体验 (Apple HIG Ambience Panel) */}
          <div className="apple-group">
            <div className="apple-group-title">{t.settings.ambienceTitle}</div>

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
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 3 }}>
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
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 3 }}>
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
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 3 }}>
                {t.settings.ecoPropsHint}
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
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 3 }}>
                  {t.settings.gyroscopeHint}
                </div>
              </div>
            ) : (
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
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 3 }}>
                  {t.settings.miniWidgetHint}
                </div>
              </div>
            )}
          </div>

          {/* 2. 系统与常驻 */}
          {inTauri && (
            <div className="apple-group">
              <div className="apple-group-title">{t.settings.groupSystem}</div>
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
              </div>
            </div>
          )}

          {/* 3. 数据备份 */}
          <div className="apple-group">
            <div className="apple-group-title">{t.settings.groupData}</div>
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
          </div>

          {/* 3.1 WebDAV 数据同步 */}
          <div className="apple-group">
            <div className="apple-group-title">{t.settings.webdav.groupTitle}</div>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>{t.settings.webdav.serverUrl}</label>
              <input
                type="text"
                placeholder="https://dav.example.com/sync/"
                value={endpoint}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: syncStatus === 'error' ? 'var(--danger)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                style={{ padding: '6px 16px', fontSize: 12.5, flexShrink: 0 }}
              >
                {isSyncing ? t.settings.webdav.syncingBtn : t.settings.webdav.syncNowBtn}
              </button>
            </div>
          </div>

          {/* 4. 自律资产统计与快捷键 */}
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line)',
              fontSize: 12.5,
              color: 'var(--ink)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{t.settings.assetSummaryTitle}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>
                {t.settings.assetSummaryDetail(habits.filter((h) => !h.archivedAt).length, completed.length)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconRepair size={13} style={{ color: 'var(--accent)' }} />
                <span>{repairBricks} / 2</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>{t.settings.repairInventory}</div>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              background: 'color-mix(in srgb, var(--ink) 4%, transparent)',
              borderRadius: 'var(--r-md)',
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconKeyboard size={14} />
              <span>{t.settings.shortcutsTitle}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>{t.settings.shortcutsDetail}</div>
          </div>

          <p style={{ fontSize: 11.5, color: 'var(--ink-2)', margin: '0', textAlign: 'center', opacity: 0.8 }}>
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
      aria-modal="true"
      tabIndex={-1}
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw' }}>
        <div className="dialog-header">
          <h3>{t.settings.title}</h3>
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
