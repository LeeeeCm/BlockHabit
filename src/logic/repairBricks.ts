/**
 * F8：修复积木经济（宽口径）
 *
 * 改前（三重稀缺，让「断签兜底」形同虚设）：
 * - 只有**落成一座建筑**才奖励 1 块（最多等于蓝图总数，追加内容包时随之增加）；
 * - 持有上限 2 块；
 * - 只能补签**过去 7 天**。
 * 结果：一个 30 天的习惯断签 8 天，几乎只能放弃重来。
 *
 * 改后：
 * - **每月 2 块**（月初把库存补足到 2，不清空已有库存）；
 * - **连击每满 30 天奖励 1 块**（与月份额度独立叠加）；
 * - 持有上限 4 块（2 月度 + 2 里程碑）；
 * - 补签窗口 **30 天**。
 */

/** 每月额度 */
export const REPAIR_MONTHLY_QUOTA = 2
/** 持有上限 */
export const REPAIR_MAX = 4
/** 连击里程碑：每满这么多天奖励 1 块 */
export const REPAIR_STREAK_MILESTONE_DAYS = 30
/** 补签窗口（天） */
export const REPAIR_WINDOW_DAYS = 30

/** 本地月份键 'YYYY-MM' */
export function monthKeyOf(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export interface AllowanceResult {
  count: number
  month: string
  /** 本次补足/新发放的数量（0 表示当月额度已结算过） */
  granted: number
}

/**
 * 月度额度结算：月份变了就把库存补足到 REPAIR_MONTHLY_QUOTA（不清空已有的里程碑奖励）。
 * 幂等：同一个月内反复调用不再发放。
 */
export function refreshMonthlyAllowance(
  count: number,
  storedMonth: string | undefined,
  now: Date = new Date()
): AllowanceResult {
  const month = monthKeyOf(now)
  const safeCount = Math.max(0, Math.min(REPAIR_MAX, count))
  if (storedMonth === month) return { count: safeCount, month, granted: 0 }
  const next = Math.min(REPAIR_MAX, Math.max(safeCount, REPAIR_MONTHLY_QUOTA))
  return { count: next, month, granted: next - safeCount }
}

/**
 * 连击里程碑奖励：从 prevStreak 涨到 nextStreak，跨过几个 30 天整数倍就奖励几块。
 * 与月度额度独立（所以上限放宽到 REPAIR_MAX）。
 */
export function repairBricksForStreak(
  count: number,
  prevStreak: number,
  nextStreak: number,
  milestone: number = REPAIR_STREAK_MILESTONE_DAYS,
  max: number = REPAIR_MAX
): number {
  if (milestone <= 0) return Math.max(0, Math.min(max, count))
  const before = Math.floor(Math.max(0, prevStreak) / milestone)
  const after = Math.floor(Math.max(0, nextStreak) / milestone)
  const gained = Math.max(0, after - before)
  if (gained === 0) return Math.max(0, Math.min(max, count))
  return Math.min(max, Math.max(0, count) + gained)
}

/** 补签窗口：today 与 date 都在 'YYYY-MM-DD' 口径下比较 */
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = new Date(fromKey + 'T00:00:00').getTime()
  const to = new Date(toKey + 'T00:00:00').getTime()
  return Math.round((to - from) / 86400000)
}

export function isWithinRepairWindow(
  dateKey: string,
  todayKey: string,
  windowDays: number = REPAIR_WINDOW_DAYS
): boolean {
  const diff = daysBetweenKeys(dateKey, todayKey)
  return diff >= 0 && diff <= windowDays
}
