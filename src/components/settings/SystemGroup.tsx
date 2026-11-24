import type { AppSettings } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { Group } from './Group'

interface Props {
  settings: AppSettings
  autostart: boolean | null
  t: TranslationSchema
  onToggleAutostart: () => void
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  /** 作为「通用」组的子段渲染，不再单独成组 */
  bare?: boolean
}

/** 系统与常驻：开机自启、全局快捷键与提醒联动提示。 */
export function SystemGroup({
  settings,
  autostart,
  t,
  onToggleAutostart,
  onUpdateSettings,
  bare = false
}: Props) {
  const content = (
    <>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>{t.settings.autostartLabel}</label>
        <div className="seg">
          <button
            className={autostart === false ? 'active' : ''}
            disabled={autostart === null}
            onClick={() => void onToggleAutostart()}
          >
            {t.settings.autostartOff}
          </button>
          <button
            className={autostart === true ? 'active' : ''}
            disabled={autostart === null}
            onClick={() => void onToggleAutostart()}
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

      {/* D-20261124-086：全局快捷键默认关，用户显式开启才注册 */}
      <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
        <label>{t.settings.quickCheckInLabel}</label>
        <div className="seg">
          <button
            className={settings.quickCheckInEnabled === true ? 'active' : ''}
            onClick={() => onUpdateSettings({ quickCheckInEnabled: true })}
          >
            {t.settings.toggleOn}
          </button>
          <button
            className={settings.quickCheckInEnabled !== true ? 'active' : ''}
            onClick={() => onUpdateSettings({ quickCheckInEnabled: false })}
          >
            {t.settings.toggleOff}
          </button>
        </div>
        <div
          style={{
            fontSize: 'var(--fs-caption)',
            color: 'var(--ink-2)',
            marginTop: 6,
            lineHeight: 1.5
          }}
        >
          {t.settings.quickCheckInHint}
        </div>
      </div>
    </>
  )

  if (bare) {
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        <div
          style={{
            fontSize: 'var(--fs-caption)',
            fontWeight: 700,
            color: 'var(--ink-2)',
            marginBottom: 8
          }}
        >
          {t.settings.groupSystem}
        </div>
        {content}
      </div>
    )
  }

  return (
    <Group title={t.settings.groupSystem} collapsible defaultOpen={false}>
      {content}
    </Group>
  )
}
