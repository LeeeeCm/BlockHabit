import { useI18n } from '../../i18n'
import { IconEcho } from '../../components/Icons'

interface Props {
  note?: string
  daysAgo: number
  habitName: string
}

/** 「回声」胶囊：展示往年今日的一条随笔（数据由 Today 计算）。 */
export function TodayEchoCapsule({ note, daysAgo, habitName }: Props) {
  const { t } = useI18n()
  return (
    <div className="echo-capsule-bar" style={{ marginTop: 14 }}>
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
          {t.reflections.echoTitle} · {t.reflections.echoDaysAgo(daysAgo)}
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
        “{note}”
      </div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
        {t.reflections.echoFromHabit(habitName)}
      </div>
    </div>
  )
}
