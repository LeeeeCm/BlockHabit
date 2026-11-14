import { getBlueprintName, useI18n } from '../../i18n'
import { IconBuild, IconPlus } from '../../components/Icons'
import { triggerHaptic } from '../../platform'

interface Props {
  now: Date
  blueprintId: string
  placedCount: number
  total: number
  percent: number
  metCount: number
  activeCount: number
  onCelebrate?: () => void
  onNewHabit: () => void
}

/** 今日页头部：日期 + 当前蓝图进度 + 今日完成数 + 新建习惯入口。 */
export function TodayHeader({
  now,
  blueprintId,
  placedCount,
  total,
  percent,
  metCount,
  activeCount,
  onCelebrate,
  onNewHabit
}: Props) {
  const { lang, t } = useI18n()
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h1 style={{ fontSize: 'var(--fs-hero)', margin: 0 }}>
        {t.common.monthDay(now.getMonth() + 1, now.getDate())}
        <span
          style={{
            color: 'var(--ink-2)',
            fontSize: 'var(--fs-subhead)',
            marginLeft: 10,
            fontWeight: 400
          }}
        >
          {t.common.weekdayLabel(t.common.weekdays[now.getDay()])}
        </span>
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          className="btn ghost"
          onClick={() => {
            triggerHaptic('selection')
            onCelebrate?.()
          }}
          style={{
            padding: '4px 11px',
            fontSize: 'var(--fs-small)',
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid var(--line)',
            background: 'var(--surface)'
          }}
          title={t.today.view3dModel}
        >
          <IconBuild size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {getBlueprintName(blueprintId, lang)}
          </span>
          <span style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-caption)' }}>
            {placedCount}/{total} ({percent}%)
          </span>
        </button>
        <span
          style={{
            color: 'var(--ink-2)',
            fontSize: 'var(--fs-body)',
            border: '1px solid var(--line)',
            borderRadius: 999,
            padding: '4px 12px'
          }}
        >
          {metCount} / {activeCount}
        </span>
        <button
          className="icon-btn"
          title={t.today.newHabit}
          onClick={() => {
            triggerHaptic('light')
            onNewHabit()
          }}
        >
          <IconPlus size={20} />
        </button>
      </div>
    </div>
  )
}
