import type { AppSettings, Language, Theme } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { triggerHaptic } from '../../platform'
import { ensureNotifyPermission } from '../../platform/notify'
import { Group } from './Group'

interface Props {
  settings: AppSettings
  lang: Language
  theme: Theme
  t: TranslationSchema
  onSetLanguage: (lang: Language) => void
  onSetTheme: (theme: Theme) => void
  onUpdateSettings: (patch: Partial<AppSettings>) => void
}

/** 界面与感官偏好分组（首屏组）：语言、主题、习惯提醒与晚间收尾提醒。 */
export function PreferencesGroup({
  settings,
  lang,
  theme,
  t,
  onSetLanguage,
  onSetTheme,
  onUpdateSettings
}: Props) {
  return (
    <Group title={t.settings.groupPreferences}>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.settings.languageLabel}</label>
        <div className="seg">
          <button className={lang === 'zh' ? 'active' : ''} onClick={() => onSetLanguage('zh')}>
            {t.settings.langZh}
          </button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => onSetLanguage('en')}>
            {t.settings.langEn}
          </button>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>{t.settings.themeLabel}</label>
        <div className="seg">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => onSetTheme('light')}>
            {t.settings.themeLight}
          </button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => onSetTheme('dark')}>
            {t.settings.themeDark}
          </button>
          <button className={theme === 'oat' ? 'active' : ''} onClick={() => onSetTheme('oat')}>
            {t.settings.themeOat}
          </button>
          <button className={theme === 'fog' ? 'active' : ''} onClick={() => onSetTheme('fog')}>
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
              onUpdateSettings({ remindersEnabled: true })
            }}
          >
            {t.settings.reminderToggleOn}
          </button>
          <button
            type="button"
            className={settings.remindersEnabled === false ? 'active' : ''}
            onClick={() => {
              triggerHaptic('selection')
              onUpdateSettings({ remindersEnabled: false })
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
                onUpdateSettings({ eveningNudgeEnabled: true })
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
                onUpdateSettings({ eveningNudgeEnabled: false })
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
            onChange={(e) => onUpdateSettings({ eveningNudgeTime: e.target.value })}
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
  )
}
