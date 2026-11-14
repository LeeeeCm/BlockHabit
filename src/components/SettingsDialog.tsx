import { useEffect, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { prepareImport } from '../storage/adapter'
import { pickAdapter } from '../storage'
import type { AppState } from '../types'
import { IconClose } from './Icons'
import { triggerHaptic, usePlatform } from '../platform'
import { BottomSheet } from './BottomSheet'
import { ConfirmDialog } from './ConfirmDialog'
import { useDialogA11y } from './useDialogA11y'
import { useSyncController } from '../sync/SyncProvider'
import { WebdavPanel } from './WebdavPanel'
import { ArchiveBackupsPanel, ArchiveDataPanel } from './ArchiveDataPanel'
import { AboutPanel } from './AboutPanel'
import { Group } from './settings/Group'
import { PreferencesGroup } from './settings/PreferencesGroup'
import { SoundGroup } from './settings/SoundGroup'
import { LabGroup } from './settings/LabGroup'
import { SystemGroup } from './settings/SystemGroup'
import { SettingsFooter } from './settings/SettingsFooter'
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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
  const importData = useAppStore((s) => s.importData)
  const habits = useAppStore((s) => s.habits)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const repairBricks = useAppStore((s) => s.repairBricks ?? 0)
  const muted = settings.soundMuted === true
  const volume = typeof settings.volume === 'number' ? settings.volume : 100
  const [msg, showMsg] = useTransient<string>(2400)
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
  // D-20261115-074：同步控制器由应用级 <SyncProvider> 持有（启动/定时同步不再依赖本弹窗挂载）
  const sync = useSyncController()
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

  const footerContent = (
    <div className="dialog-footer" style={{ borderTop: 'none', padding: 0 }}>
      <button
        className="btn primary"
        onClick={onClose}
        style={{ padding: '7px 24px', width: isMobile ? '100%' : undefined }}
      >
        {t.common.complete}
      </button>
    </div>
  )

  const bodyContent = (
    <>
      {/* 1. 界面与感官偏好 */}
      <PreferencesGroup
        settings={settings}
        lang={lang}
        theme={theme}
        t={t}
        onSetLanguage={setLanguage}
        onSetTheme={setTheme}
        onUpdateSettings={updateSettings}
      />

      <SoundGroup muted={muted} volume={volume} t={t} onUpdateSettings={updateSettings} />

      {/* 2. 感官与氛围体验 (Apple HIG Ambience Panel) */}
      <LabGroup
        settings={settings}
        isMobile={isMobile}
        t={t}
        onUpdateSettings={updateSettings}
        onToast={showMsg}
      />

      {/* 2. 系统与常驻 */}
      {inTauri && (
        <SystemGroup
          settings={settings}
          autostart={autostart}
          t={t}
          onToggleAutostart={toggleAutostart}
        />
      )}

      {/* 3. 数据备份 */}
      <Group title={t.settings.groupData} collapsible defaultOpen={false}>
        <ArchiveDataPanel onImportFile={doImport} />
      </Group>

      {/* 3.05 备份与恢复（桌面端）：可见、可恢复的本地备份 */}
      {inTauri && (
        <Group title={t.settings.backupsTitle} collapsible defaultOpen={false}>
          <ArchiveBackupsPanel onToast={showMsg} onRestoreCandidate={setImportCandidate} />
        </Group>
      )}

      {/* 3.1 WebDAV 数据同步 */}
      <Group title={t.settings.webdav.groupTitle} collapsible>
        <WebdavPanel sync={sync} onToast={showMsg} />
      </Group>

      {/* 3.2 内容路线 / 关于（C2：D-20261110-063 §3.5.5） */}
      <Group title={t.settings.aboutTitle} collapsible defaultOpen={false}>
        <AboutPanel />
      </Group>

      {/* 4. 自律资产统计与快捷键 */}
      <SettingsFooter
        habits={habits}
        completedCount={completed.length}
        repairBricks={repairBricks}
        t={t}
      />
    </>
  )

  if (isMobile) {
    return (
      <BottomSheet
        open={true}
        onClose={onClose}
        title={t.settings.title}
        footer={footerContent}
        escEnabled={!importCandidate}
      >
        {bodyContent}
        {msg && <div className="toast">{msg}</div>}
        {importCandidate && (
          <ConfirmDialog
            title={t.settings.importConfirmTitle}
            message={t.settings.importConfirmMsg(
              useAppStore.getState().habits.length,
              useAppStore.getState().checkIns.length
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
      <div
        className="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 480, maxWidth: '92vw' }}
      >
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

        <div className="dialog-body">{bodyContent}</div>

        {footerContent}

        {msg && <div className="toast">{msg}</div>}
        {importCandidate && (
          <ConfirmDialog
            title={t.settings.importConfirmTitle}
            message={t.settings.importConfirmMsg(
              useAppStore.getState().habits.length,
              useAppStore.getState().checkIns.length
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
