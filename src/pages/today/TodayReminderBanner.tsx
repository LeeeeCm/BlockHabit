import { useI18n } from '../../i18n'
import { IconMoodHard } from '../../components/Icons'
import { triggerHaptic } from '../../platform'
import type { PendingReminder } from '../../store/reminderStore'

interface Props {
  reminders: PendingReminder[]
  onReopen: () => void
}

/** 到点提醒横幅：点击重新打开提醒弹窗（待办仍保留在横幅里）。 */
export function TodayReminderBanner({ reminders, onReopen }: Props) {
  const { t } = useI18n()
  return (
    <div
      className="reminder-banner"
      role="button"
      tabIndex={0}
      onClick={() => {
        triggerHaptic('light')
        onReopen()
      }}
      onKeyDown={(e) => e.key === 'Enter' && onReopen()}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 'var(--fs-subhead)',
            color: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--ink-2)' }}>
            <IconMoodHard size={14} />
          </span>
          <span>{t.reminder.bannerTitle(reminders.length)}</span>
        </div>
        <div
          style={{
            fontSize: 'var(--fs-small)',
            color: 'var(--ink-2)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {reminders.map((r) => r.name).join(' · ')} — {t.reminder.bannerHint}
        </div>
      </div>
      <span
        style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-heading)', flexShrink: 0 }}
        aria-hidden="true"
      >
        ›
      </span>
    </div>
  )
}
