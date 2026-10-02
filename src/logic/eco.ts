/**
 * 连胜微生态彩蛋的阶段计算：
 * - 阶段 0：未萌芽（连胜 0 天）
 * - 阶段 1 萌芽：≥1 天（绿色小积木灌木）
 * - 阶段 2 积木小径：≥7 天（石/绿交替积木小径）
 * - 阶段 3 积木树：≥21 天（树干 + 双层绿冠）
 * - 阶段 4 积木花园：≥100 天（点缀色花砖 + 后缘灌木）
 */
export function ecoStageFor(maxStreak: number): 0 | 1 | 2 | 3 | 4 {
  if (maxStreak >= 100) return 4
  if (maxStreak >= 21) return 3
  if (maxStreak >= 7) return 2
  if (maxStreak >= 1) return 1
  return 0
}
