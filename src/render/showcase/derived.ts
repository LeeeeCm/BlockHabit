/**
 * 展台沙盘的纯派生（拆分自 ShowcaseScene.tsx）：
 * 连击奖励等级表——store 数据的纯函数，不碰 canvas / React。
 */
import type { PlacedBlock } from '../../types'

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
