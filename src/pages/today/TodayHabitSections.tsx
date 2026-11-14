import { HabitRow } from '../../components/HabitRow'
import { useI18n } from '../../i18n'
import { currentStreakWithResilience } from '../../logic/streak'
import { habitMetOnDay } from '../../logic/checkin'
import type { CheckIn, CheckInResult, Habit, HabitPeriod } from '../../types'
import { PERIOD_ORDER } from './todayUtils'

interface Props {
  grouped: Map<HabitPeriod, Habit[]>
  checkIns: CheckIn[]
  now: Date
  day: string
  enableGentleDecay: boolean
  onCheck: (res: CheckInResult, habit: Habit) => void
  onNoteSaved: () => void
  onEdit: (habit: Habit) => void
}

/** 按「任意 → 早晨 → 午后 → 夜晚」分组的习惯卡片列表。 */
export function TodayHabitSections({
  grouped,
  checkIns,
  now,
  day,
  enableGentleDecay,
  onCheck,
  onNoteSaved,
  onEdit
}: Props) {
  const { t } = useI18n()
  return PERIOD_ORDER.map((p) => {
    const list = grouped.get(p)!
    if (list.length === 0) return null
    return (
      <section key={p} style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 'var(--fs-small)',
            color: 'var(--ink-2)',
            letterSpacing: '0.14em',
            margin: '4px 2px 10px'
          }}
        >
          {t.today.periods[p]}
        </div>
        <div className="habit-grid">
          {list.map((h) => {
            const streakInfo = currentStreakWithResilience(h, checkIns, now, enableGentleDecay)
            // 完成态 = 今日有打卡 且 达标（counter 未满目标不亮绿勾；周频达标但今日未打卡不算完成）
            const doneToday =
              checkIns.some((c) => !c.deletedAt && c.habitId === h.id && c.date === day) &&
              habitMetOnDay(h, checkIns, day)
            return (
              <HabitRow
                key={h.id}
                habit={h}
                day={day}
                done={doneToday}
                streak={streakInfo.streak}
                inRestPeriod={streakInfo.inRestPeriod}
                resilienceProtected={streakInfo.protectedContinuation === true}
                onCheck={onCheck}
                onNoteSaved={onNoteSaved}
                onEdit={onEdit}
                domId={`habit-${h.id}`}
              />
            )
          })}
        </div>
      </section>
    )
  })
}
