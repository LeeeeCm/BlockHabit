import type { HabitPeriod } from '../../types'

/** 自上而下：任意 → 早晨 → 午后 → 夜晚 */
export const PERIOD_ORDER: HabitPeriod[] = ['any', 'morning', 'afternoon', 'evening']

/** 滚动到某张习惯卡并脉冲高亮：提醒跳转与今日简报「开始第一个」共用同一套定位 */
export function focusHabitCard(id: string | null | undefined) {
  if (!id) return
  const el = document.getElementById(`habit-${id}`)
  if (!el) return
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  el.classList.add('habit-focus-flash')
  setTimeout(() => el.classList.remove('habit-focus-flash'), 2600)
}

/** 积木掉落弹窗的展示状态（Today 持有状态，弹窗只读） */
export interface DropModalState {
  habitName: string
  placedCount: number
  complete: boolean
  checkInId?: string
}

/** 今日页 toast 展示状态 */
export interface TodayToast {
  text: string
  accent?: boolean
}
