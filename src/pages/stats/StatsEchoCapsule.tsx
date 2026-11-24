import type { CheckIn, Habit } from '../../types'
import type { TranslationSchema } from '../../i18n/types'
import { IconEcho } from '../../components/Icons'

interface Props {
  t: TranslationSchema
  echoEntry: CheckIn | null
  echoDaysAgo: number
  habits: Habit[]
}

/** 积木历史回响时间胶囊（无历史随笔时不渲染） */
export function StatsEchoCapsule({ t, echoEntry, echoDaysAgo, habits }: Props) {
  if (!echoEntry) return null
  return (
    <div className="echo-capsule-bar">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--fs-caption)',
          color: 'var(--accent)',
          fontWeight: 700
        }}
      >
        <IconEcho size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span>
          {t.reflections.echoTitle} · {t.reflections.echoDaysAgo(echoDaysAgo)}
        </span>
      </div>
      <div
        style={{
          fontSize: 'var(--fs-body)',
          color: 'var(--ink)',
          fontStyle: 'italic',
          marginTop: 2,
          lineHeight: 1.5
        }}
      >
        “{echoEntry.note}”
      </div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
        {t.reflections.echoFromHabit(habits.find((h) => h.id === echoEntry.habitId)?.name || '—')}
      </div>
    </div>
  )
}
