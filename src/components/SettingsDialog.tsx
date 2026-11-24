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
import { ArchiveBackupsPanel, ArchiveDataPanel, DiagnosticsExportPanel } from './ArchiveDataPanel'
import { HabitImportPanel } from './HabitImportPanel'
import { AboutPanel } from './AboutPanel'
import { Group } from './settings/Group'
import { PreferencesGroup } from './settings/PreferencesGroup'
import { SoundGroup } from './settings/SoundGroup'
import { LabGroup } from './settings/LabGroup'
import { PetSettingsGroup } from './settings/PetSettingsGroup'
import { SystemGroup } from './settings/SystemGroup'
import { SettingsFooter } from './settings/SettingsFooter'
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

interface Props {
  onClose: () => void
  /** 桌宠右键：打开后滚动到桌宠分组 */
  focusPet?: boolean
}

export function SettingsDialog({ onClose, focusPet = false }: Props) {
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
    if (!focusPet) return
    const frame = requestAnimationFrame(() => {
      document.getElementById('pet-settings')?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusPet])
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
      {/* 1. 通用：界面 / 声音 / 提醒 / 系统（同一组内分段，减少分类） */}
      <PreferencesGroup
        settings={settings}
        lang={lang}
        theme={theme}
        t={t}
        onSetLanguage={setLanguage}
        onSetTheme={setTheme}
        onUpdateSettings={updateSettings}
      >
        <SoundGroup muted={muted} volume={volume} t={t} onUpdateSettings={updateSettings} bare />
        {inTauri && (
          <SystemGroup
            settings={settings}
            autostart={autostart}
            t={t}
            onToggleAutostart={toggleAutostart}
            onUpdateSettings={updateSettings}
            bare
          />
        )}
      </PreferencesGroup>

      {/* 2. 桌宠：独立分组，右键桌宠直达 */}
      <PetSettingsGroup settings={settings} t={t} onUpdateSettings={updateSettings} />

      {/* 3. 数据与同步：备份 / 导入 / 诊断 / 完整档案包 / WebDAV */}
      <Group title={t.settings.groupData} collapsible defaultOpen={false}>
        <ArchiveDataPanel onImportFile={doImport} />
        <HabitImportPanel onToast={showMsg} />
        <DiagnosticsExportPanel onToast={showMsg} />
        {inTauri && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div
              style={{
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                color: 'var(--ink-2)',
                marginBottom: 8
              }}
            >
              {t.settings.backupsTitle}
            </div>
            <ArchiveBackupsPanel onToast={showMsg} onRestoreCandidate={setImportCandidate} />
          </div>
        )}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          <div
            style={{
              fontSize: 'var(--fs-caption)',
              fontWeight: 700,
              color: 'var(--ink-2)',
              marginBottom: 8
            }}
          >
            {t.settings.webdav.groupTitle}
          </div>
          <WebdavPanel sync={sync} onToast={showMsg} />
        </div>
      </Group>

      {/* 3. 关于 */}
      <Group title={t.settings.aboutTitle} collapsible defaultOpen={false}>
        <AboutPanel />
      </Group>

      {/* 4. 实验室：视觉实验开关与页面提示 */}
      <LabGroup
        settings={settings}
        isMobile={isMobile}
        t={t}
        onUpdateSettings={updateSettings}
        onToast={showMsg}
      />

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
