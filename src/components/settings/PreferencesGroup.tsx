import type { ReactNode } from 'react'
import type { AppSettings, Language, Theme } from '../../types'
import type { TranslationSchema } from '../../i18n'
import { triggerHaptic } from '../../platform'
import { ensureNotifyPermission } from '../../platform/notify'
import { Group } from './Group'
import { TimeWheelPicker } from '../TimeWheelPicker'

interface Props {
  settings: AppSettings
  lang: Language
  theme: Theme
  t: TranslationSchema
  onSetLanguage: (lang: Language) => void
  onSetTheme: (theme: Theme) => void
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  /** 同一组内的声音 / 系统子段（由 SettingsDialog 传入） */
  children?: ReactNode
}

/** 通用偏好分组：语言、主题、提醒、晚间收尾，以及声音 / 系统子段。 */
export function PreferencesGroup({
  settings,
  lang,
  theme,
  t,
  onSetLanguage,
  onSetTheme,
  onUpdateSettings,
  children
}: Props) {
  return (
    <Group title={t.settings.groupPreferences} collapsible defaultOpen>
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
        {/* D-20261126-115：开关与时间共同占满整行 —— 分段开关吃掉剩余宽度，
            右侧是 Apple 闹钟式双列循环滚轮（小时 0–23 / 分钟 00–59，首尾相接）。 */}
        <div className="settings-actions" style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
          <div className="seg" style={{ flex: '1 1 auto', minWidth: 0 }}>
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
          <TimeWheelPicker
            value={settings.eveningNudgeTime ?? '21:00'}
            disabled={settings.eveningNudgeEnabled !== true}
            ariaLabel={t.eveningNudge.settingsTime}
            hourLabel={t.eveningNudge.pickerHour}
            minuteLabel={t.eveningNudge.pickerMinute}
            onChange={(next) => onUpdateSettings({ eveningNudgeTime: next })}
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
      {children}
    </Group>
  )
}
