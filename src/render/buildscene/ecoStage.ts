import type { CheckIn, Habit } from '../../types'
import { currentStreakWithResilience } from '../../logic/streak'
import { ecoStageFor } from '../../logic/eco'

/**
 * 构造场景的微生态彩蛋效果（拆分自 BuildScene.tsx 的 ecoStage memo 体）：
 * 取所有在册习惯（跳过已归档）的最大连胜（含韧性接续），映射到 0-4 阶段。
 * 关闭彩蛋时恒为 0，绘制侧据此跳过全部植被/地景小件。
 */
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
