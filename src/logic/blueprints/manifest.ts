/**
 * 蓝图注册表的内容版本（B1 / D-20261110-063）。
 *
 * schemaVersion 管「数据形状」，contentVersion 管「蓝图内容」。
 * 追加蓝图时只 +contentVersion，绝不升 schemaVersion：
 * 旧客户端必须在 sanitize 之前被门禁拦住，否则未知 blueprint 的
 * builds/completed 会被静默清洗并落盘（数据丢失）。
 */
import { blueprintOrder } from './index'

/**
 * 当前安装包内置的蓝图内容版本：
 * 1 = 基础 12 座；2 = 追加「城市与生活」6 座（treehouse/greenhouse/clocktower/bridge/observatory/library）。
 */
export const CONTENT_VERSION = 2

export interface ContentPack {
  id: string
  version: number
  releasedAt: string
  blueprintIds: string[]
}

/** 内容包 v2 追加的 6 座（顺序即解锁顺序，追加在基础包之后） */
export const CONTENT_PACK_V2_IDS: readonly string[] = [
  'treehouse',
  'greenhouse',
  'clocktower',
  'bridge',
  'observatory',
  'library',
] as const

/** 基础包 = order 中除去 v2 追加的其余蓝图（不硬编码 12） */
const BASE_PACK_IDS = blueprintOrder.filter((id) => !CONTENT_PACK_V2_IDS.includes(id))

/** 内容包 manifest 是构建期元数据，不联网下载、不校验签名（内容随安装包内置） */
export const CONTENT_PACKS: ContentPack[] = [
  {
    id: 'base',
    version: 1,
    releasedAt: '2026-11-10',
    blueprintIds: [...BASE_PACK_IDS],
  },
  {
    id: 'city-life',
    version: 2,
    releasedAt: '2026-11-11',
    blueprintIds: [...CONTENT_PACK_V2_IDS],
  },
]

/** 把任意输入归一化为合法内容版本：缺省/非法 → 当前版本 */
export function normalizeContentVersion(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : CONTENT_VERSION
}

/** 存档里的内容版本高于本安装包 → 必须走 needsUpgrade，禁止 sanitize */
export function isFutureContentVersion(value: unknown): boolean {
  return normalizeContentVersion(value) > CONTENT_VERSION
}
