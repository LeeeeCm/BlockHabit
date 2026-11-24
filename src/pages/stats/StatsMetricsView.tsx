import type { CheckIn, Habit } from '../../types'
import type { TranslationSchema } from '../../i18n/types'
import { Heatmap } from '../../components/Heatmap'
import { IconNote } from '../../components/Icons'
import { REPAIR_WINDOW_DAYS } from '../../logic/repairBricks'
import type { RepairTarget, StatsRow } from './types'

interface Props {
  t: TranslationSchema
  habits: Habit[]
  checkIns: CheckIn[]
  rows: StatsRow[]
  today: string
  repairBricks: number
  onRequestRepair: (target: RepairTarget) => void
  onRefreshRepair: () => void
  onToast: (message: string, durationMs?: number) => void
}

/** 指标视图：每个习惯一张热图卡片 + 连击/次数/专注 + 近期随笔 */
export function StatsMetricsView({
  t,
  habits,
  checkIns,
  rows,
  today,
  repairBricks,
  onRequestRepair,
  onRefreshRepair,
  onToast
}: Props) {
  if (rows.length === 0) {
    return (
      <div style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-subhead)' }}>{t.stats.empty}</div>
    )
  }

  return (
    <div>
      {rows.map(({ habit, current, best, total, totalMinutes }) => (
        <div
          key={habit.id}
          className="card"
          style={{
            padding: '16px 18px',
            marginBottom: 14
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <Heatmap
              habits={habits}
              checkIns={checkIns}
              habitId={habit.id}
              cell={13}
              weeks={13}
              onDayClick={(day) => {
                const todayMs = new Date(today + 'T00:00:00').getTime()
                const diffDays = Math.round(
                  (todayMs - new Date(day + 'T00:00:00').getTime()) / 86400000
                )
                const already = checkIns.some((c) => c.habitId === habit.id && c.date === day)
                if (already) return
                if (diffDays > REPAIR_WINDOW_DAYS || diffDays < 0) {
                  onToast(t.stats.repairLimitToast, 2200)
                  return
                }
                if (repairBricks <= 0) {
                  // 月初第一次进来可能还没结算：触发一次并提示
                  onRefreshRepair()
                  onToast(t.stats.repairNoBricksToast, 2600)
                  return
                }
                onRequestRepair({ habitId: habit.id, habitName: habit.name, date: day })
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-title)' }}>{habit.name}</div>
              <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
                {habit.frequency.type === 'daily'
                  ? t.today.freqDaily
                  : habit.frequency.type === 'weekly'
                    ? t.today.freqWeekly(habit.frequency.times)
                    : t.today.freqCustom(
                        habit.frequency.days.map((d) => t.common.weekdaysShort[d - 1])
                      )}
              </div>
            </div>
            {totalMinutes > 0 && (
              <Stat
                label={t.stats.metric.focusTime}
                value={
                  totalMinutes >= 60
                    ? t.stats.metric.hours((totalMinutes / 60).toFixed(1))
                    : t.stats.metric.minutes(totalMinutes)
                }
              />
            )}
            <Stat
              label={t.stats.metric.currentStreak}
              value={current}
              accent={current > 0 && current % 7 === 0}
            />
            <Stat label={t.stats.metric.bestStreak} value={best} title={t.stats.bestStreak(best)} />
            <Stat label={t.stats.metric.totalCheckIns} value={total} />
          </div>

          {(() => {
            const notes = checkIns
              .filter((c) => c.habitId === habit.id && c.note?.trim())
              .sort((a, b) => (b.date > a.date ? 1 : -1))
              .slice(0, 3)
            if (notes.length === 0) return null
            return (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
                <div
                  style={{
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--ink-2)',
                    marginBottom: 6,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <IconNote size={13} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
                  <span>{t.stats.recentReflections}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        fontSize: 'var(--fs-small)',
                        color: 'var(--ink)',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'baseline'
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--fs-caption)',
                          color: 'var(--ink-2)',
                          flexShrink: 0
                        }}
                      >
                        {n.date}
                      </span>
                      <span style={{ minWidth: 0, wordBreak: 'break-word', opacity: 0.88 }}>
                        {n.note}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      ))}
    </div>
  )
}

function Stat({
  label,
  value,
  accent = false,
  title
}: {
  label: string
  value: number | string
  accent?: boolean
  title?: string
}) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }} title={title}>
      <div
        style={{
          fontSize: 'var(--fs-heading)',
          fontWeight: 700,
          color: accent ? 'var(--progress-green)' : 'var(--ink)'
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>{label}</div>
    </div>
  )
}
