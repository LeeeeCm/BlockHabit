import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
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

/**
 * 热图单元格底色：**灰阶点亮**（D-20261110-035 / B3）。
 *
 * 依据 design/AESTHETIC.md：「日历热图：近 13 周，用灰阶点亮，"全完成日"才允许满亮。」
 * 此前的绿→蓝色阶是第二套色相，与 A1「黑白灰为骨、唯一点缀色」相抵；绿色从此只保留给进度条。
 */
export function cellColor(ratio: number, future: boolean): string {
  if (future || ratio < 0) return 'transparent'
  if (ratio >= 1) return 'var(--ink)' // 全完成日：满亮
  if (ratio <= 0) return 'var(--line)' // 空：底板灰
  // 部分完成：用墨色按比例叠在卡片底色上，深浅随完成度递增（两个主题都成立）
  const mix = Math.round(15 + ratio * 60)
  return `color-mix(in srgb, var(--ink) ${mix}%, var(--surface))`
}

/** 日历热图：列=周，行=周一..周日；圆角单元格，灰阶点亮、全完成日满亮 */
export function Heatmap({ habits, checkIns, weeks = 13, habitId, cell, onDayClick }: Props) {
  const { t } = useI18n()
  const CELL = cell ?? 19
  const GAP = cell ? Math.max(3, Math.round(cell * 0.22)) : 5

  /** roving tabindex（C5）：整张热图只占 1 个 tab 停留点，方向键在格子间移动。
   * 13 周 × 7 天 = 91 个格子若全部进 tab 序列，多习惯统计页会有 500+ 个停留点，键盘用户永远走不出去。 */
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())

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

  const todayKeyStr = dateKey(startOfDay(new Date()))
  const allKeys = columns.flatMap((c) => c.days.map((d) => d.key))
  // 默认停靠点：今天（在范围内时）→ 否则最后一个非未来日 → 否则第一格
  const defaultKey =
    allKeys.find((k) => k === todayKeyStr) ??
    [...columns]
      .reverse()
      .flatMap((c) => [...c.days].reverse())
      .find((d) => !d.future)?.key ??
    allKeys[0]
  const currentKey = focusKey ?? defaultKey

  const moveFocus = (delta: number | 'home' | 'end') => {
    const i = allKeys.indexOf(currentKey)
    if (i < 0) return
    const weekStart = Math.floor(i / 7) * 7
    const next =
      delta === 'home' ? allKeys[weekStart] : delta === 'end' ? allKeys[weekStart + 6] : allKeys[i + delta]
    if (!next) return
    setFocusKey(next)
    cellRefs.current.get(next)?.focus()
  }

  const onCellKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp') moveFocus(-1)
    else if (e.key === 'ArrowDown') moveFocus(1)
    else if (e.key === 'ArrowLeft') moveFocus(-7)
    else if (e.key === 'ArrowRight') moveFocus(7)
    else if (e.key === 'Home') moveFocus('home')
    else if (e.key === 'End') moveFocus('end')
    else return
    e.preventDefault()
  }

  return (
    <div role="group" aria-label={t.stats.heatmapLabel}>
      <div style={{ display: 'flex', gap: GAP, justifyContent: 'center' }}>
        {columns.map((col) => (
          <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            <div style={{ height: 16, fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
              {col.month}
            </div>
            {col.days.map((d) => {
              const clickable = !d.future && d.ratio < 1 && Boolean(onDayClick)
              const label = `${d.key}${d.ratio >= 0 ? (habitId ? (d.ratio >= 1 ? ` · ${t.stats.heatmapDone}` : ` · ${t.stats.heatmapRepair}`) : ` · ${Math.round(d.ratio * 100)}%`) : ''}`
              return (
                <button
                  key={d.key}
                  type="button"
                  ref={(el) => {
                    if (el) cellRefs.current.set(d.key, el)
                    else cellRefs.current.delete(d.key)
                  }}
                  tabIndex={d.key === currentKey ? 0 : -1}
                  onKeyDown={onCellKeyDown}
                  onClick={() => clickable && onDayClick?.(d.key)}
                  // 不用 disabled：禁用按钮既无法聚焦也无法被读屏浏览；用 aria-disabled 表达「不可操作」
                  aria-disabled={!clickable}
                  aria-current={d.key === todayKeyStr ? 'date' : undefined}
                  aria-label={label}
                  title={label}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: Math.max(4, Math.round(CELL * 0.28)),
                    background: cellColor(d.ratio, d.future),
                    border: d.future ? 'none' : '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
                    cursor: clickable ? 'pointer' : 'default',
                    padding: 0,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
