import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { soundMuted, setSoundMuted } from '../audio/sound'
import { useI18n } from '../i18n'
import { IconKeyboard, IconRepair } from './Icons'
import { usePlatform } from '../platform'
import { BottomSheet } from './BottomSheet'
const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

interface Props {
  onClose: () => void
}

export function SettingsDialog({ onClose }: Props) {
  const { lang, t } = useI18n()
  const { isMobile } = usePlatform()
  const theme = useAppStore((s) => s.settings.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const exportData = useAppStore((s) => s.exportData)
  const importData = useAppStore((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)
  const habits = useAppStore((s) => s.habits)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const repairBricks = useAppStore((s) => s.repairBricks ?? 0)
  const [muted, setMuted] = useState(() => soundMuted)
  const [msg, setMsg] = useState<string | null>(null)
  const [autostart, setAutostart] = useState<boolean | null>(null)
  useEffect(() => {
    if (!inTauri) return
    void (async () => {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart')
      setAutostart(await isEnabled())
    })()
  }, [])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
    const text = await file.text()
    const ok = importData(text)
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
            <div className="apple-group-title">{lang === 'zh' ? '界面偏好' : 'PREFERENCES'}</div>

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
                  onClick={() => {
                    setSoundMuted(false)
                    setMuted(false)
                  }}
                >
                  {t.settings.soundOn}
                </button>
                <button
                  className={muted ? 'active' : ''}
                  onClick={() => {
                    setSoundMuted(true)
                    setMuted(true)
                  }}
                >
                  {t.settings.soundOff}
                </button>
              </div>
            </div>
          </div>

          {/* 2. 系统与常驻 */}
          {inTauri && (
            <div className="apple-group">
              <div className="apple-group-title">{lang === 'zh' ? '系统集成' : 'SYSTEM'}</div>
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
            <div className="apple-group-title">{lang === 'zh' ? '数据安全' : 'BACKUP & DATA'}</div>
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
      <BottomSheet open={true} onClose={onClose} title={t.settings.title} footer={footerContent}>
        {bodyContent}
        {msg && <div className="toast">{msg}</div>}
      </BottomSheet>
    )
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw' }}>
        <div className="dialog-header">
          <h3>{t.settings.title}</h3>
          <button className="icon-btn" onClick={onClose} title={t.common.close}>
            ✕
          </button>
        </div>

        <div className="dialog-body">
          {bodyContent}
        </div>

        {footerContent}

        {msg && <div className="toast">{msg}</div>}
      </div>
    </div>
  )
}
