import { useMemo } from 'react'
import type { CheckIn, Habit } from '../types'
import { addDays, dateKey, startOfDay } from '../logic/dates'
import { dayCompletionRatio } from '../logic/checkin'

interface Props {
  habits: Habit[]
  checkIns: CheckIn[]
  weeks?: number
}

/** 热图单元格底色：0=线条灰，>0 按比例点亮琥珀，1=满亮 */
function cellColor(ratio: number, future: boolean): string {
  if (future) return 'transparent'
  if (ratio >= 1) return 'var(--accent)'
  if (ratio <= 0) return 'var(--line)'
  const pct = Math.round(30 + ratio * 55)
  return `color-mix(in srgb, var(--accent) ${pct}%, var(--bg))`
}

/** 日历热图：列=周，行=周一..周日；放大圆角单元格，琥珀点亮色阶 */
export function Heatmap({ habits, checkIns, weeks = 13 }: Props) {
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
          ratio: dayCompletionRatio(habits, checkIns, key),
          future: date > today,
        }
      })
      cols.push({ key: dateKey(monday), month: monthLabel, days })
    }
    return cols
  }, [habits, checkIns, weeks])

  const CELL = 19
  const GAP = 5

  return (
    <div>
      <div style={{ display: 'flex', gap: GAP }}>
        {columns.map((col) => (
          <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            <div style={{ height: 16, fontSize: 10.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
              {col.month}
            </div>
            {col.days.map((d) => (
              <div
                key={d.key}
                title={`${d.key}${d.ratio >= 0 ? ` · ${Math.round(d.ratio * 100)}%` : ''}`}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 6,
                  background: cellColor(d.ratio, d.future),
                  border: d.future ? 'none' : '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 14,
          fontSize: 12,
          color: 'var(--ink-2)',
          alignItems: 'center',
        }}
      >
        <span>少</span>
        {[0, 0.33, 0.66, 1].map((r) => (
          <span
            key={r}
            style={{
              width: 16,
              height: 16,
              borderRadius: 5,
              background: cellColor(r, false),
              border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
            }}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  )
}
