import { CONTENT_PACKS, CONTENT_VERSION, type ContentPack } from './manifest'
import { blueprints, blueprintOrder } from './index'

/**
 * 内容包脚手架（C3 / D-20261110-063 的 v3 准备）。
 *
 * 本模块只提供「校验 / 规划」纯函数，**不含任何建筑数据**：未获人类确认的新内容包
 * 不得写入 generators.ts（建筑数据属设计性资产，见 AGENTS §2）。未来实现 v3 时：
 *   1. 先新增 approved 设计记录（主题 / 座数 / 块数 / 节奏）；
 *   2. 用 validateContentPackDraft 校验候选包（id 唯一、版本单调、追加在既有 order 之后）；
 *   3. 再写 generators 与 i18n 名称。
 *
 * 当前不被应用运行路径引用，只用于脚手架测试与发布门禁，可被 tree-shake。
 */

export interface ContentPackDraft {
  id: string
  version: number
  blueprintIds: string[]
}

export interface ContentPackCheck {
  ok: boolean
  errors: string[]
}

export interface ContentPackRules {
  /** 每座建筑允许的块数下限（v3 建议 80） */
  minBlocksPerBuilding?: number
  /** 每座建筑允许的块数上限（v3 建议 120） */
  maxBlocksPerBuilding?: number
  /** 单包最少座数（v3 建议 4） */
  minPackBuildings?: number
  /** 单包最多座数（v3 建议 6） */
  maxPackBuildings?: number
  /** 整包块数下限（v3 建议 400） */
  minPackBlocks?: number
  /** 整包块数上限（v3 建议 600） */
  maxPackBlocks?: number
}

/** 校验上下文：测试可注入合成注册表，无需真实新增建筑数据 */
export interface ContentPackContext {
  /** 已发布的内容包（默认 CONTENT_PACKS） */
  packs?: ContentPack[]
  /** 当前蓝图顺序（默认 blueprintOrder） */
  order?: string[]
  /** 已注册蓝图 id → 块数（默认从 blueprints 计算） */
  blockCounts?: Record<string, number>
  /** 当前安装包内容版本（默认 CONTENT_VERSION） */
  currentVersion?: number
}

export const DEFAULT_CONTENT_PACK_RULES: Required<ContentPackRules> = {
  minBlocksPerBuilding: 80,
  maxBlocksPerBuilding: 120,
  minPackBuildings: 4,
  maxPackBuildings: 6,
  minPackBlocks: 400,
  maxPackBlocks: 600,
}

const PACK_ID_RE = /^[a-z0-9][a-z0-9-]*$/

/** 已发布内容包占用的全部蓝图 id（按包顺序） */
export function existingPackBlueprintIds(packs: ContentPack[] = CONTENT_PACKS): string[] {
  return packs.flatMap((pack) => pack.blueprintIds)
}

/** 某批蓝图的总块数（未知 id 计 0；调用方应先用校验排除未知 id） */
export function packBlockCount(
  blueprintIds: string[],
  blockCounts?: Record<string, number>,
): number {
  const counts = blockCounts ?? countRegisteredBlocks()
  let total = 0
  for (const id of blueprintIds) total += counts[id] ?? 0
  return total
}

/** 注册表 id → 块数 */
export function countRegisteredBlocks(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [id, blueprint] of Object.entries(blueprints)) counts[id] = blueprint.blocks.length
  return counts
}

/** 下一个内容版本号（只 +1，不升 schemaVersion） */
export function nextContentVersion(currentVersion: number = CONTENT_VERSION): number {
  return currentVersion + 1
}

/** 把新包追加到现有蓝图顺序末尾（纯函数；不校验，校验交给 validateContentPackDraft） */
export function planAppendedOrder(draft: ContentPackDraft, order: string[] = blueprintOrder): string[] {
  return [...order, ...draft.blueprintIds]
}

/**
 * 校验一个候选内容包草案（不写盘、不改注册表）。
 * 默认规则按 C3 评估建议（4–6 座、每座 80–120 块、整包 400–600 块），可覆盖用于其他规模。
 */
export function validateContentPackDraft(
  draft: ContentPackDraft,
  options: { context?: ContentPackContext; rules?: ContentPackRules } = {},
): ContentPackCheck {
  const context = options.context ?? {}
  const rules = { ...DEFAULT_CONTENT_PACK_RULES, ...options.rules }
  const packs = context.packs ?? CONTENT_PACKS
  const order = context.order ?? blueprintOrder
  const blockCounts = context.blockCounts ?? countRegisteredBlocks()
  const currentVersion = context.currentVersion ?? CONTENT_VERSION
  const errors: string[] = []

  if (!PACK_ID_RE.test(String(draft.id ?? ''))) {
    errors.push('id 必须是小写字母/数字/连字符（例如 city-life-2）')
  }
  if (packs.some((pack) => pack.id === draft.id)) {
    errors.push('id 与已发布内容包重复：' + draft.id)
  }

  const expectedVersion = nextContentVersion(currentVersion)
  if (!Number.isInteger(draft.version) || draft.version !== expectedVersion) {
    errors.push('version 必须为 nextContentVersion() = ' + expectedVersion + '（当前 ' + currentVersion + '）')
  }

  const ids = draft.blueprintIds ?? []
  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    errors.push('blueprintIds 存在重复 id')
  }
  const existing = new Set(existingPackBlueprintIds(packs))
  for (const id of ids) {
    if (existing.has(id)) errors.push('蓝图已在既有内容包中：' + id)
    if (!(id in blockCounts)) errors.push('蓝图未注册：' + id)
  }

  // 新包只能整体追加在既有蓝图之后：不得包含既有蓝图（否则会改变既有解锁顺序）
  for (const id of ids) {
    if (order.includes(id)) errors.push('候选包不得包含既有蓝图（不得调整既有解锁顺序）：' + id)
  }

  if (ids.length < rules.minPackBuildings || ids.length > rules.maxPackBuildings) {
    errors.push('座数 ' + ids.length + ' 不在 ' + rules.minPackBuildings + '–' + rules.maxPackBuildings + ' 之间')
  }
  for (const id of ids) {
    const count = blockCounts[id]
    if (count == null) continue
    if (count < rules.minBlocksPerBuilding || count > rules.maxBlocksPerBuilding) {
      errors.push('建筑 ' + id + ' 块数 ' + count + ' 不在 ' + rules.minBlocksPerBuilding + '–' + rules.maxBlocksPerBuilding + ' 之间')
    }
  }
  const total = packBlockCount(ids, blockCounts)
  if (ids.length > 0 && (total < rules.minPackBlocks || total > rules.maxPackBlocks)) {
    errors.push('整包块数 ' + total + ' 不在 ' + rules.minPackBlocks + '–' + rules.maxPackBlocks + ' 之间')
  }

  return { ok: errors.length === 0, errors }
}