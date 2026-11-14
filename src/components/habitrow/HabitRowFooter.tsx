import type { TranslationSchema } from '../../i18n'

interface Props {
  t: TranslationSchema
  done: boolean
  isRestDay: boolean
  streak: number
  onPillClick: (e: React.MouseEvent) => void
}

/** 卡片底部：完成/休整/待打卡胶囊 + 当前连击。 */
export function HabitRowFooter({ t, done, isRestDay, streak, onPillClick }: Props) {
  return (
    <div
      style={{
        marginTop: 'auto',
        paddingTop: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
      }}
    >
      <span
        style={{
          fontSize: 'var(--fs-small)',
          borderRadius: 999,
          padding: '3px 11px',
          color: done ? 'var(--accent-ink)' : 'var(--ink-2)',
          background: done
            ? 'var(--progress-green)'
            : isRestDay
              ? 'color-mix(in srgb, var(--ink) 4%, transparent)'
              : 'var(--bg)',
          border: done ? 'none' : '1px solid var(--line)',
          cursor: done ? 'pointer' : 'default'
        }}
        onClick={onPillClick}
        title={done ? t.today.undoTooltip : isRestDay ? t.today.restDay : undefined}
      >
        {done ? t.today.completedPill : isRestDay ? t.today.restDay : t.today.checkInTooltip}
      </span>
      {streak > 0 && (
        <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
          {t.stats.currentStreak(streak)}
        </span>
      )}
    </div>
  )
}
