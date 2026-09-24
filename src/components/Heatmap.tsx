import { useMemo } from 'react'
import type { CheckIn, Habit } from '../types'
import { addDays, dateKey, startOfDay } from '../logic/dates'
import { dayCompletionRatio, habitActiveOnDay, habitMetOnDay } from '../logic/checkin'
import { useI18n } from '../i18n'

interface Props {
  habits: Habit[]
  checkIns: CheckIn[]
  weeks?: number
  /** 只看单个习惯（用于习惯统计卡）：绿=当天完成 */
  habitId?: string
  cell?: number
  onDayClick?: (day: string) => void
}

/** 热图单元格底色：无数据/未来透明，白(空) → 蓝(进行中) → 绿(全部完成) */
function cellColor(ratio: number, future: boolean): string {
  if (future || ratio < 0) return 'transparent'
  if (ratio >= 1) return 'var(--progress-green)'
  if (ratio <= 0) return 'var(--line)'
  // 低比例偏蓝，高比例向绿过渡
  const greenMix = Math.round(ratio * 85)
  return `color-mix(in srgb, var(--progress-green) ${greenMix}%, var(--progress-blue))`
}

/** 日历热图：列=周，行=周一..周日；圆角单元格，白→蓝→绿色阶 */
export function Heatmap({ habits, checkIns, weeks = 13, habitId, cell, onDayClick }: Props) {
  const { t } = useI18n()
  const CELL = cell ?? 19
  const GAP = cell ? Math.max(3, Math.round(cell * 0.22)) : 5

  const ratioOf = (key: string): number => {
    if (habitId) {
      const h = habits.find((x) => x.id === habitId)
      if (!h || !habitActiveOnDay(h, key)) return -1
      return habitMetOnDay(h, checkIns, key) ? 1 : 0
    }
    return dayCompletionRatio(habits, checkIns, key)
  }

  const columns = useMemo(() => {
    const today = startOfDay(new Date())
    const thisMonday = new Date(today)
    thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7))
    const cols: Array<{ key: string; month: string; days: Array<{ key: string; ratio: number; future: boolean }> }> = []
    let lastMonth = ''
    for (let w = weeks - 1; w >= 0; w--) {
      const monday = addDays(thisMonday, -7 * w)
      const m = `${monday.getFullYear()}.${String(monday.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = m !== lastMonth ? m : ''
      lastMonth = m
      const days = Array.from({ length: 7 }, (_, d) => {
        const date = addDays(monday, d)
        const key = dateKey(date)
        return {
          key,
          ratio: ratioOf(key),
          future: date > today,
        }
      })
      cols.push({ key: dateKey(monday), month: monthLabel, days })
    }
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, checkIns, weeks, habitId])

  return (
    <div>
      <div style={{ display: 'flex', gap: GAP, justifyContent: 'center' }}>
        {columns.map((col) => (
          <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            <div style={{ height: 16, fontSize: 10.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
              {col.month}
            </div>
            {col.days.map((d) => (
              <div
                key={d.key}
                onClick={() => onDayClick?.(d.key)}
                title={`${d.key}${d.ratio >= 0 ? (habitId ? (d.ratio >= 1 ? ` · ${t.stats.heatmapDone}` : ` · ${t.stats.heatmapRepair}`) : ` · ${Math.round(d.ratio * 100)}%`) : ''}`}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: Math.max(4, Math.round(CELL * 0.28)),
                  background: cellColor(d.ratio, d.future),
                  border: d.future ? 'none' : '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
                  cursor: !d.future && d.ratio < 1 && onDayClick ? 'pointer' : 'default',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
