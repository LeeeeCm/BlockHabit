import type { BlockDef, PlacedBlock } from '../types'
import { blueprintOrder, findBlueprint, isPetBlueprintId, PET_BLUEPRINT_IDS } from './blueprints'

/** 蓝图第 placedCount 块（数组顺序即拼建顺序），越界返回 null */
export function nextSlot(blocks: BlockDef[], placedCount: number): BlockDef | null {
  return blocks[placedCount] ?? null
}

export function isComplete(blocks: BlockDef[], placedCount: number): boolean {
  return placedCount >= blocks.length
}

/** 连击每满 7 天，下一次奖励为 bonus 积木（点缀色渲染） */
export function awardBlock(streak: number): boolean {
  return streak > 0 && streak % 7 === 0
}

/** 主线第一个未完成蓝图；桌宠不参与顺序。 */
export function firstIncompleteIndex(completed: readonly string[]): number {
  const index = blueprintOrder.findIndex((id) => !completed.includes(id))
  return index < 0 ? blueprintOrder.length : index
}

export function canSelectBlueprint(id: string, completed: readonly string[]): boolean {
  if (isPetBlueprintId(id)) return true
  const idx = blueprintOrder.indexOf(id)
  return idx >= 0 && idx <= firstIncompleteIndex(completed)
}

/** 同一蓝图的有效积木，一块只占一个已知槽位；忽略墓碑与重复记录。 */
export function validPlacedBlocks(builds: readonly PlacedBlock[], id: string): PlacedBlock[] {
  const capacity = findBlueprint(id)?.blocks.length ?? 0
  if (!capacity) return []
  const slots = new Set<number>()
  const ids = new Set<string>()
  return builds.filter((block) => {
    if (block.blueprintId !== id || block.deletedAt || !block.id) return false
    const { index } = block
    if (!Number.isInteger(index) || index < 0 || index >= capacity) return false
    if (slots.has(index) || ids.has(block.id)) return false
    slots.add(index)
    ids.add(block.id)
    return true
  })
}

export interface BlueprintProgress {
  placed: number
  total: number
  complete: boolean
}

export function blueprintProgress(builds: readonly PlacedBlock[], id: string): BlueprintProgress {
  const total = findBlueprint(id)?.blocks.length ?? 0
  const placed = validPlacedBlocks(builds, id).length
  return { placed, total, complete: total > 0 && placed === total }
}

/** 「全部落成」看完整目录；不能用重复/额外 ID 或过期的支线完成缓存凑数量。 */
export function completedCatalogCount(
  completed: readonly string[],
  builds: readonly PlacedBlock[]
): number {
  const mainCount = blueprintOrder.filter((id) => completed.includes(id)).length
  const petCount = PET_BLUEPRINT_IDS.filter((id) => blueprintProgress(builds, id).complete).length
  return mainCount + petCount
}
