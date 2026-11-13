import { useEffect, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import type { ReactNode } from 'react'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../i18n'
import { prepareImport } from '../storage/adapter'
import { resetGuideTips } from '../platform/guideTips'
import { ensureNotifyPermission } from '../platform/notify'
import { pickAdapter } from '../storage'
import type { AppState } from '../types'
import { IconClose, IconKeyboard, IconRepair } from './Icons'
import { triggerHaptic, usePlatform } from '../platform'
import { BottomSheet } from './BottomSheet'
import { ConfirmDialog } from './ConfirmDialog'
import { useDialogA11y } from './useDialogA11y'
import { useSync } from '../sync/useSync'
import { WebdavPanel } from './WebdavPanel'
import { ArchiveBackupsPanel, ArchiveDataPanel, DiagnosticsExportPanel } from './ArchiveDataPanel'
import { AboutPanel } from './AboutPanel'
import { MINI_SIZE_ORDER } from '../platform/miniWindow'
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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
  defaultOpen = true
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
            ? {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none'
              }
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
              transform: open ? 'rotate(90deg)' : 'none'
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
  const sync = useSync()
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
                opacity: settings.eveningNudgeEnabled === true ? 1 : 0.45
              }}
            />
          </div>
          <div
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'var(--ink-2)',
              marginTop: 4,
              lineHeight: 1.5
            }}
          >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              opacity: muted ? 0.4 : 1
            }}
          >
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', flexShrink: 0 }}>
              {t.settings.volumeLabel}
            </span>
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
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--ink-2)',
                width: 32,
                textAlign: 'right',
                flexShrink: 0
              }}
            >
              {volume}
            </span>
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
                metal: t.settings.soundMatMetal
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

        <DiagnosticsExportPanel onToast={showMsg} />

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
              <button
                className={autostart === false ? 'active' : ''}
                disabled={autostart === null}
                onClick={() => void toggleAutostart()}
              >
                {t.settings.autostartOff}
              </button>
              <button
                className={autostart === true ? 'active' : ''}
                disabled={autostart === null}
                onClick={() => void toggleAutostart()}
              >
                {t.settings.autostartOn}
              </button>
            </div>
            {settings.remindersEnabled !== false && autostart === false && (
              <div
                style={{
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--ink-2)',
                  marginTop: 6,
                  lineHeight: 1.5
                }}
              >
                {t.settings.reminderAutostartHint}
              </div>
            )}
          </div>
        </Group>
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
          marginBottom: 10
        }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{t.settings.assetSummaryTitle}</div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
            {t.settings.assetSummaryDetail(
              habits.filter((h) => !h.archivedAt).length,
              completed.length
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontWeight: 700,
              color: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <IconRepair size={13} style={{ color: 'var(--accent)' }} />
            <span>{repairBricks} / 2</span>
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
            {t.settings.repairInventory}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px 14px',
          background: 'color-mix(in srgb, var(--ink) 4%, transparent)',
          borderRadius: 'var(--r-md)',
          fontSize: 'var(--fs-small)',
          marginBottom: 14
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: 'var(--ink)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <IconKeyboard size={14} />
          <span>{t.settings.shortcutsTitle}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
          {t.settings.shortcutsDetail}
        </div>
      </div>

      <p
        style={{
          fontSize: 'var(--fs-small)',
          color: 'var(--ink-2)',
          margin: '0',
          textAlign: 'center',
          opacity: 0.8
        }}
      >
        {t.settings.slogan}
      </p>
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
