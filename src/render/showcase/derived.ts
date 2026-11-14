/**
 * 展台沙盘的纯派生（拆分自 ShowcaseScene.tsx）：
 * 连击奖励等级表与微生态彩蛋阶段——都是 store 数据的纯函数，不碰 canvas / React。
 */
import type { CheckIn, Habit, PlacedBlock } from '../../types'
import { ecoStageFor } from '../../logic/eco'
import { currentStreakWithResilience } from '../../logic/streak'

/** B1/B5：蓝图 → 序位 → 奖励等级（streak / attendance）。用 ref 承载，避免进入 draw 的依赖数组导致重绑监听 */
export function buildBonusByBlueprint(
  builds: PlacedBlock[]
): Map<string, Array<'streak' | 'attendance' | undefined>> {
  const map = new Map<string, Array<'streak' | 'attendance' | undefined>>()
  for (const b of builds) {
    let list = map.get(b.blueprintId)
    if (!list) {
      list = []
      map.set(b.blueprintId, list)
    }
    list[b.index] = b.bonus ? (b.fromHabitId === '__day__' ? 'attendance' : 'streak') : undefined
  }
  return map
}

/** 微生态彩蛋阶段：所有在册习惯的最大连胜（与建造页同一口径） */
export function computeEcoStage(
  habits: Habit[],
  checkIns: CheckIn[],
  enableEcoProps: boolean
): number {
  if (!enableEcoProps) return 0
  const today = new Date()
  let maxStreak = 0
  for (const h of habits) {
    if (h.archivedAt) continue
    maxStreak = Math.max(maxStreak, currentStreakWithResilience(h, checkIns, today, true).streak)
  }
  return ecoStageFor(maxStreak)
}
