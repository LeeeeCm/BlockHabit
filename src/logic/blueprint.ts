import type { BlockDef } from '../types'

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
