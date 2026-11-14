import type { AppSettings } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { Group } from './Group'

interface Props {
  settings: AppSettings
  autostart: boolean | null
  t: TranslationSchema
  onToggleAutostart: () => void
}

/** 系统与常驻分组（仅桌面端渲染）：开机自启与提醒联动提示。 */
export function SystemGroup({ settings, autostart, t, onToggleAutostart }: Props) {
  return (
    <Group title={t.settings.groupSystem} collapsible defaultOpen={false}>
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
    </Group>
  )
}
