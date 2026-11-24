import type { TranslationSchema } from '../../i18n/types'
import { IconGallery, IconRepair } from '../../components/Icons'
import { triggerHaptic } from '../../platform'
import { REPAIR_MAX } from '../../logic/repairBricks'

interface Props {
  t: TranslationSchema
  grandTotalMinutes: number
  repairBricks: number
  onOpenMemorabilia: () => void
}

/** 统计页页头：标题 / 副标 / 纪念品入口 / 修复砖余额 */
export function StatsHeader({ t, grandTotalMinutes, repairBricks, onOpenMemorabilia }: Props) {
  return (
    <div
      className="stats-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12
      }}
    >
      <div>
        <h1 style={{ fontSize: 'var(--fs-title)', margin: 0 }}>{t.stats.title}</h1>
        <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
          {t.stats.subtitle}
          {grandTotalMinutes > 0 && (
            <span> · {t.stats.focusHours((grandTotalMinutes / 60).toFixed(1))}</span>
          )}
        </div>
      </div>

      <div
        className="stats-header-actions"
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <button
          className="btn ghost stats-header-pill block-action"
          onClick={() => {
            triggerHaptic('light')
            onOpenMemorabilia()
          }}
          title={t.stats.memorabiliaTitle}
        >
          <IconGallery size={14} style={{ color: 'var(--ink)' }} />
          <span>{t.stats.memorabiliaBtn}</span>
        </button>

        <div
          className="stats-header-pill block-action is-static"
          style={{ fontWeight: 600 }}
          title={t.stats.repairBricksTooltip}
        >
          <IconRepair size={13} style={{ color: 'var(--accent)' }} />
          <span>{t.stats.repairBricksBadge(repairBricks, REPAIR_MAX)}</span>
        </div>
      </div>
    </div>
  )
}
