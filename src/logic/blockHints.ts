/**
 * 「打卡成功但没有掉块」的原因判别（F2 / D-20261110-041）。
 *
 * 为什么单独成模块：这是**规则**而不是展示——三种原因对应三种文案与三种用户行动，
 * 之前内联在 Today.tsx 的 else 分支里，只能靠浏览器手测覆盖。抽到纯逻辑层后可单测。
 */
export type NoBlockReason =
  | 'normal' // 正常掉块路径（不应走到提示，但保留给调用方判断）
  | 'active-blueprint-complete' // 当前蓝图已满，还有下一座
  | 'all-blueprints-complete' // 全部蓝图落成

export interface NoBlockContext {
  /** 已完成蓝图数 */
  completedBlueprints: number
  /** 蓝图总数 */
  blueprintTotal: number
  /** 当前蓝图已放置块数 */
  placedCount: number
  /** 当前蓝图总块数 */
  activeBlueprintBlocks: number
}

export function noBlockReason(ctx: NoBlockContext): NoBlockReason {
  if (ctx.completedBlueprints >= ctx.blueprintTotal) return 'all-blueprints-complete'
  if (ctx.placedCount >= ctx.activeBlueprintBlocks) return 'active-blueprint-complete'
  return 'normal'
}
