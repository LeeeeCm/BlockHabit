import type { Habit } from '../../types'

/** 指标视图的一行：习惯 + 当前/最长连击 + 总次数 + 专注分钟 */
export interface StatsRow {
  habit: Habit
  current: number
  best: number
  total: number
  totalMinutes: number
}

/** 待确认的补签目标 */
export interface RepairTarget {
  habitId: string
  habitName: string
  date: string
}
