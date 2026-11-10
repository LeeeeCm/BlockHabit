/**
 * 存档字段的唯一白名单（Wave 0 / 技术笔记 §0.1.5）。
 *
 * 为什么必须共享：持久化、导出、WebDAV 推送三处曾经各写一份白名单，
 * 结果 repairBrickMonth 只进了导出、没进持久化与同步 —— 重启后月度修复砖额度
 * 会被当成「未结算」再发一次（可刷砖）。抽成纯函数后漂移只可能发生在这一处。
 */
import type { AppState } from '../types'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'

export function serializeState(state: AppState): AppState {
  const {
    schemaVersion,
    habits,
    checkIns,
    builds,
    activeBlueprintId,
    completedBlueprintIds,
    settings,
    dayClaims,
    deletedDayClaims,
    repairBricks,
    repairBrickMonth,
    showcasePlacements,
    foundationNotes,
    reminderLog,
  } = state
  return {
    schemaVersion,
    // 统一写当前内容版本：应用可能已产出更高版本内容，不能沿用来源版本
    contentVersion: CONTENT_VERSION,
    habits,
    checkIns,
    builds,
    activeBlueprintId,
    completedBlueprintIds,
    settings,
    dayClaims,
    deletedDayClaims,
    repairBricks,
    repairBrickMonth,
    showcasePlacements,
    foundationNotes,
    reminderLog,
  }
}
