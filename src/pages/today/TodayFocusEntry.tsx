import { useI18n } from '../../i18n'
import { IconInProgress } from '../../components/Icons'
import { triggerHaptic } from '../../platform'
import type { Habit } from '../../types'

interface Props {
  habit: Habit
  isMobile: boolean
  onStart: () => void
}

/** B4：今日页专注入口 —— 有可开始的专注习惯且当前无任何会话时出现。 */
export function TodayFocusEntry({ habit, isMobile, onStart }: Props) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      data-testid="today-focus-entry"
      title={t.focusCompanion.startHint}
      aria-label={`${t.focusCompanion.start} · ${habit.name} · ${t.today.targetMinutes(habit.targetMinutes ?? 25)}`}
      onClick={() => {
        triggerHaptic('medium')
        onStart()
      }}
      style={{
        width: '100%',
        margin: '14px 0 6px',
        padding: '12px 16px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        color: 'var(--ink)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        cursor: 'pointer',
        minHeight: isMobile ? 48 : undefined
      }}
    >
      <IconInProgress size={18} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontSize: 'var(--fs-small)',
            fontWeight: 600,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {t.focusCompanion.start} · {habit.name} ·{' '}
          {t.today.targetMinutes(habit.targetMinutes ?? 25)}
        </span>
        <span
          style={{
            fontSize: 'var(--fs-caption)',
            color: 'var(--ink-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {t.focusCompanion.startHint}
        </span>
      </span>
    </button>
  )
}
