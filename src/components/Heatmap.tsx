import { useMemo } from 'react'
import type { CheckIn, Habit } from '../types'
import { addDays, dateKey, startOfDay } from '../logic/dates'
import { dayCompletionRatio } from '../logic/checkin'

interface Props {
  habits: Habit[]
  checkIns: CheckIn[]
  weeks?: number
}

/** 日历热图：列=周，行=周一..周日；灰阶=完成比例，点缀色=全完成 */
export function Heatmap({ habits, checkIns, weeks = 13 }: Props) {
  const columns = useMemo(() => {
    const today = startOfDay(new Date())
    const thisMonday = new Date(today)
    thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7))
    const cols: Array<{ key: string; days: Array<{ key: string; ratio: number; future: boolean }> }> = []
    for (let w = weeks - 1; w >= 0; w--) {
      const monday = addDays(thisMonday, -7 * w)
      const days = Array.from({ length: 7 }, (_, d) => {
        const date = addDays(monday, d)
        const key = dateKey(date)
        return {
          key,
          ratio: dayCompletionRatio(habits, checkIns, key),
          future: date > today,
        }
      })
      cols.push({ key: dateKey(monday), days })
    }
    return cols
  }, [habits, checkIns, weeks])

  return (
    <div>
      <div style={{ display: 'flex', gap: 3 }}>
        {columns.map((col) => (
          <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {col.days.map((d) => (
              <div
                key={d.key}
                title={`${d.key}${d.ratio >= 0 ? ` · ${Math.round(d.ratio * 100)}%` : ''}`}
                style={{
                  width: 11,
                  height: 11,
                  background:
                    d.future || d.ratio < 0
                      ? 'transparent'
                      : d.ratio >= 1
                        ? 'var(--accent)'
                        : d.ratio > 0
                          ? `color-mix(in srgb, var(--ink) ${20 + d.ratio * 45}%, var(--bg))`
                          : 'var(--line)',
                  border: '1px solid var(--line)',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, fontSize: 11, color: 'var(--ink-2)', alignItems: 'center' }}>
        <span>少</span>
        <span style={{ width: 11, height: 11, background: 'var(--line)', border: '1px solid var(--line)' }} />
        <span style={{ width: 11, height: 11, background: 'color-mix(in srgb, var(--ink) 45%, var(--bg))' }} />
        <span style={{ width: 11, height: 11, background: 'color-mix(in srgb, var(--ink) 65%, var(--bg))' }} />
        <span style={{ width: 11, height: 11, background: 'var(--accent)' }} />
        <span>多</span>
      </div>
    </div>
  )
}
