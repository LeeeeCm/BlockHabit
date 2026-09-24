import type { BlockDef } from '../types'
import { blueprintOrder } from './blueprints'

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

/** 顺序解锁：第一个未完成蓝图之前（含自身）才可选用 */
export function firstIncompleteIndex(completed: string[]): number {
  for (let i = 0; i < blueprintOrder.length; i++) {
    if (!completed.includes(blueprintOrder[i])) return i
  }
  return blueprintOrder.length
}

export function canSelectBlueprint(id: string, completed: string[]): boolean {
  const idx = blueprintOrder.indexOf(id)
  if (idx < 0) return false
  return idx <= firstIncompleteIndex(completed)
}
