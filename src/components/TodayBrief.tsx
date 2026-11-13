import { useI18n, getBlueprintName } from '../i18n'
import { IconBuild, IconCheck } from './Icons'
import type { TodayBriefState } from '../logic/todayBrief'

/**
 * 今日简报（D-20261110-052）：问候 + 今日事实 + 下一里程碑 + 一键开始。
 * 纯展示组件：状态由 logic/todayBrief 计算，保证「完成」判定与 habitMetOnDay 同口径。
 */
export function TodayBrief({
  brief,
  onStartFirst
}: {
  brief: TodayBriefState
  onStartFirst: () => void
}) {
  const { lang, t } = useI18n()
  const facts =
    brief.done > 0
      ? t.todayBrief.inProgress(brief.done, brief.total, brief.pending)
      : t.todayBrief.idle(brief.total)
  const milestone =
    brief.remainingBlocks > 0
      ? t.todayBrief.milestone(
          getBlueprintName(brief.activeBlueprintId, lang),
          brief.remainingBlocks
        )
      : brief.nextBlueprintId
        ? t.todayBrief.nextReady(getBlueprintName(brief.nextBlueprintId, lang))
        : null

  return (
    <div
      className="today-brief"
      style={{
        margin: '14px 0 6px',
        padding: '12px 16px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }}
    >
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--fs-subhead)',
            fontWeight: 700,
            color: 'var(--ink)',
            lineHeight: 1.35
          }}
        >
          {t.todayBrief.greetings[brief.greeting]}
        </div>
        <div
          style={{
            fontSize: 'var(--fs-small)',
            color: 'var(--ink-2)',
            marginTop: 2,
            lineHeight: 1.5
          }}
        >
          {facts}
        </div>
        {milestone && (
          <div
            style={{
              fontSize: 'var(--fs-caption)',
              color: 'var(--ink-2)',
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              minWidth: 0
            }}
          >
            <IconBuild size={12} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {milestone}
            </span>
          </div>
        )}
      </div>
      {brief.firstPendingHabitId && (
        <button
          className="btn primary"
          onClick={onStartFirst}
          style={{
            padding: '7px 16px',
            borderRadius: 999,
            fontSize: 'var(--fs-body)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0
          }}
        >
          <IconCheck size={15} />
          {t.todayBrief.startFirst}
        </button>
      )}
    </div>
  )
}
