import type { TranslationSchema } from '../../i18n'

interface Props {
  t: TranslationSchema
  /** 状态胶囊：不做提示式文案，只在有真实状态时出现 */
  status: { text: string; clickable: boolean; title?: string } | null
  streak: number
  onPillClick: (e: React.MouseEvent) => void
}

/** 卡片底部：状态胶囊（完成 / 本周进度 / 免战）+ 当前连击。 */
export function HabitRowFooter({ t, status, streak, onPillClick }: Props) {
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
      {status ? (
        <span
          style={{
            fontSize: 'var(--fs-small)',
            borderRadius: 999,
            padding: '3px 11px',
            color: status.clickable ? 'var(--accent-ink)' : 'var(--ink-2)',
            background: status.clickable
              ? 'var(--progress-green)'
              : 'color-mix(in srgb, var(--ink) 4%, transparent)',
            border: status.clickable ? 'none' : '1px solid var(--line)',
            cursor: status.clickable ? 'pointer' : 'default'
          }}
          onClick={onPillClick}
          title={status.title}
        >
          {status.text}
        </span>
      ) : (
        <span />
      )}
      {streak > 0 && (
        <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
          {t.stats.currentStreak(streak)}
        </span>
      )}
    </div>
  )
}
