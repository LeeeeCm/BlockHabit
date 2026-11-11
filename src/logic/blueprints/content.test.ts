import { describe, expect, it } from 'vitest'
import type { BlockDef } from '../../types'
import { getTranslation } from '../../i18n'
import { BLUEPRINT_CAPACITY } from '../builds'
import { canSelectBlueprint, firstIncompleteIndex } from '../blueprint'
import { blueprintOrder, blueprints } from './index'
import {
  CONTENT_PACKS,
  CONTENT_PACK_V2_IDS,
  CONTENT_PACK_V3_IDS,
  CONTENT_VERSION,
} from './manifest'
import { APPROVED_BLUEPRINT_COLORS } from './palette'

/**
 * 内容包构建期校验：B1 / D-20261110-063（v2）+ D-20261111-067（逐座材质色）
 * + D-20261111-070（v3，城市与生活续章 5 座）。
 *
 * 锁定的事：
 * - manifest 三包（base v1 / city-life v2 / city-life-2 v3）与注册表并集、顺序、版本一致；
 * - 基础 12 座 1385 块、v2 6 座 600 块、v3 5 座 500 块，全量 23 座 / 2485 块；
 * - 既有 18 座逐块与本轮起点 HEAD 一致（几何/顺序/块数/色值零改动，指纹锁定）；
 * - 新 5 座结构契约（80–120 块、4–12 层、坐标唯一、无完全悬空、z 有序、装饰克制）；
 * - 全部块色值都在 D-067 批准的 24 色材质调色板内；
 * - 解锁顺序自动跟随注册表（v2 全部落成后才解锁 v3）。
 */

/** 完全悬空 = 正下方无块，且同层四邻也无块（允许 1 格悬挑，禁止孤岛） */
function isCompletelyFloating(block: BlockDef, occupied: Set<string>): boolean {
  if (block.z === 0) return false
  const below = occupied.has(`${block.x},${block.y},${block.z - 1}`)
  if (below) return false
  const neighbors: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  return !neighbors.some(([dx, dy]) => occupied.has(`${block.x + dx},${block.y + dy},${block.z}`))
}

/** 块列表稳定指纹（FNV-1a 32bit）：逐块锁定坐标/类型/色值，防止「只改块数不改坐标」的假通过 */
function fingerprint(blocks: BlockDef[]): string {
  const s = JSON.stringify(blocks)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const BASE_ORDER = [
  'plant',
  'coffee',
  'camera',
  'windmill',
  'cabin',
  'rocket',
  'lighthouse',
  'factory',
  'monument',
  'pyramid',
  'robot',
  'castle',
]

const V2_ORDER = [
  'treehouse',
  'greenhouse',
  'clocktower',
  'bridge',
  'observatory',
  'library',
]

/** 基础 12 座的权威块数（D-067 配色只改 color 字段，几何/块数必须逐座不变） */
const BASE_BLOCK_COUNTS: Record<string, number> = {
  plant: 24,
  coffee: 21,
  camera: 53,
  windmill: 91,
  cabin: 116,
  rocket: 107,
  lighthouse: 131,
  factory: 175,
  monument: 147,
  pyramid: 165,
  robot: 165,
  castle: 190,
}

/** 内容包 v2 的权威块数（D-067：treehouse +4 树冠、bridge +2 灯柱） */
const V2_BLOCK_COUNTS: Record<string, number> = {
  treehouse: 119,
  greenhouse: 83,
  clocktower: 99,
  bridge: 101,
  observatory: 90,
  library: 108,
}

/** 内容包 v3 的权威块数（D-20261111-070） */
const V3_BLOCK_COUNTS: Record<string, number> = {
  bakery: 98,
  bookshop: 104,
  postoffice: 92,
  firestation: 112,
  watertower: 94,
}

/**
 * 旧 18 座逐块指纹（v3 起点 HEAD de034e6 的编译产物）。
 * D-20261111-070 要求既有 18 座几何/顺序/块数/色值零改动，只允许在末尾追加 v3；
 * 任何旧座的变化（含改色）都会让这里变红——如确需变化，必须有新的 approved 记录并同步更新本常量。
 */
const OLD_18_FINGERPRINTS: Record<string, string> = {
  plant: 'ee267029',
  coffee: 'd9079a8f',
  camera: 'e788bec6',
  windmill: 'd7c5aae9',
  cabin: '3d22bce4',
  rocket: 'f5e39528',
  lighthouse: 'cedea03f',
  factory: '66d9e114',
  monument: 'c418727b',
  pyramid: 'be102f70',
  robot: '5853996a',
  castle: '666fea10',
  treehouse: '6e3854fb',
  greenhouse: '70d8a2dc',
  clocktower: '46dcb4df',
  bridge: '4343cede',
  observatory: '76d2da80',
  library: 'ba2282b4',
}

const ZH = getTranslation('zh')
const EN = getTranslation('en')

describe('内容包 manifest（B1 / D-20261111-070）', () => {
  it('CONTENT_VERSION = 3，包含 base(v1) / city-life(v2) / city-life-2(v3) 三个内容包', () => {
    expect(CONTENT_VERSION).toBe(3)
    expect(CONTENT_PACKS.map((pack) => pack.id)).toEqual(['base', 'city-life', 'city-life-2'])
    expect(CONTENT_PACKS.map((pack) => pack.version)).toEqual([1, 2, 3])
    expect(CONTENT_PACKS.map((pack) => pack.version).sort()).toEqual([1, 2, CONTENT_VERSION])
  })

  it('内容包版本递增、发布日期合法、ids 唯一', () => {
    for (const pack of CONTENT_PACKS) {
      expect(pack.version).toBeGreaterThanOrEqual(1)
      expect(pack.version).toBeLessThanOrEqual(CONTENT_VERSION)
      expect(pack.releasedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Set(pack.blueprintIds).size).toBe(pack.blueprintIds.length)
      expect(pack.blueprintIds.length).toBeGreaterThan(0)
    }
    const allIds = CONTENT_PACKS.flatMap((pack) => pack.blueprintIds)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('内容包并集恰好等于 blueprintOrder（顺序也一致）', () => {
    expect(CONTENT_PACKS.flatMap((pack) => pack.blueprintIds)).toEqual([...blueprintOrder])
  })

  it('三个内容包分别对应权威 id 列表（v3 严格追加在 v2 之后）', () => {
    const [base, v2, v3] = CONTENT_PACKS
    expect(base.blueprintIds).toEqual(BASE_ORDER)
    expect(v2.blueprintIds).toEqual([...(CONTENT_PACK_V2_IDS as string[])])
    expect(v3.blueprintIds).toEqual([...(CONTENT_PACK_V3_IDS as string[])])
    // v2/v3 不得被误算进基础包（BASE_PACK_IDS 推导必须同时排除两代扩展包）
    expect(base.blueprintIds).toHaveLength(12)
    expect(v2.version).toBe(2)
    expect(v3.version).toBe(3)
    expect(v3.releasedAt).toBe('2026-11-11')
  })

  it('基础 12 座顺序/块数保持原样（D-067 只改颜色，几何不动）', () => {
    expect(blueprintOrder.slice(0, 12)).toEqual(BASE_ORDER)
    for (const id of BASE_ORDER) {
      expect(blueprints[id].blocks.length, `${id} 块数`).toBe(BASE_BLOCK_COUNTS[id])
    }
    const baseTotal = BASE_ORDER.reduce((sum, id) => sum + blueprints[id].blocks.length, 0)
    expect(baseTotal).toBe(1385)
  })

  it('基础 12 座坐标/类型/排序不变（颜色允许按 D-067 更新）', () => {
    for (const id of BASE_ORDER) {
      const blocks = blueprints[id].blocks
      const keys = blocks.map((block) => `${block.x},${block.y},${block.z}`)
      // 坐标唯一（重复坐标会让积木重叠）
      expect(new Set(keys).size, `${id} 坐标重复`).toBe(keys.length)
      // 自下而上排序（数组顺序 = 拼建顺序，改动会破坏既有存档的 index 语义）
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i].z, `${id} z 排序`).toBeGreaterThanOrEqual(blocks[i - 1].z)
      }
      // 类型仍是 basic/window/gate（D-067 不改类型）
      for (const block of blocks) {
        expect(['basic', 'window', 'gate'], `${id} 类型`).toContain(block.type)
      }
    }
  })

  it('既有 18 座逐块零改动（块数 + 坐标/类型/色值指纹均与 v3 起点 HEAD 一致）', () => {
    expect(blueprintOrder.slice(0, 18)).toEqual([...BASE_ORDER, ...V2_ORDER])
    for (const id of [...BASE_ORDER, ...V2_ORDER]) {
      expect(blueprints[id].blocks.length, `${id} 块数`).toBe(
        BASE_BLOCK_COUNTS[id] ?? V2_BLOCK_COUNTS[id],
      )
      expect(fingerprint(blueprints[id].blocks), `${id} 逐块指纹（几何/顺序/色值）`).toBe(
        OLD_18_FINGERPRINTS[id],
      )
    }
  })

  it('全部 23 座使用的颜色都来自 D-067 批准材质调色板（v3 不新增色相）', () => {
    for (const id of blueprintOrder) {
      for (const block of blueprints[id].blocks) {
        if (!block.color) continue
        expect(
          APPROVED_BLUEPRINT_COLORS.has(block.color),
          `${id} 使用了未批准颜色 ${block.color}`,
        ).toBe(true)
      }
    }
  })
})

describe('蓝图注册表完备性', () => {
  it('order 内 id 唯一，全部注册且 id 与键一致（当前安装包 23 座）', () => {
    expect(new Set(blueprintOrder).size).toBe(blueprintOrder.length)
    expect(Object.keys(blueprints)).toHaveLength(blueprintOrder.length)
    expect(blueprintOrder).toHaveLength(23)
    for (const id of blueprintOrder) {
      expect(blueprints[id], `blueprint ${id} missing`).toBeDefined()
      expect(blueprints[id].id).toBe(id)
    }
  })

  it('扩展包整体追加：v2 在基础 12 座之后、v3 在 v2 之后', () => {
    expect(CONTENT_PACK_V2_IDS).toHaveLength(6)
    expect(CONTENT_PACK_V3_IDS).toHaveLength(5)
    expect(blueprintOrder.slice(12, 18)).toEqual([...CONTENT_PACK_V2_IDS])
    expect(blueprintOrder.slice(18)).toEqual([...CONTENT_PACK_V3_IDS])
    for (const id of CONTENT_PACK_V2_IDS) expect(BASE_ORDER).not.toContain(id)
    for (const id of CONTENT_PACK_V3_IDS) {
      expect(BASE_ORDER).not.toContain(id)
      expect(V2_ORDER).not.toContain(id)
    }
  })

  it('容量表由注册表自动派生（每座容量 = blocks.length）', () => {
    expect(Object.keys(BLUEPRINT_CAPACITY)).toHaveLength(blueprintOrder.length)
    for (const id of blueprintOrder) {
      expect(BLUEPRINT_CAPACITY[id], `capacity ${id}`).toBe(blueprints[id].blocks.length)
    }
  })

  it('每座蓝图都有中文与英文名称（i18n 已配齐，不是裸 id）', () => {
    for (const id of blueprintOrder) {
      expect(ZH.blueprints[id], `zh name missing: ${id}`).toBeTruthy()
      expect(EN.blueprints[id], `en name missing: ${id}`).toBeTruthy()
      expect(ZH.blueprints[id]).not.toBe(id)
      expect(EN.blueprints[id]).not.toBe(id)
    }
  })
})

describe('内容包 v2 的 6 座结构', () => {
  it('每座 40–120 块（避免单座过长，拖慢建造页）', () => {
    for (const id of CONTENT_PACK_V2_IDS) {
      const count = blueprints[id].blocks.length
      expect(count, `${id} blocks`).toBeGreaterThanOrEqual(40)
      expect(count, `${id} blocks`).toBeLessThanOrEqual(120)
    }
  })

  it('v2 逐座块数为权威值（D-067：treehouse +4 树冠、bridge +2 灯柱）', () => {
    for (const id of CONTENT_PACK_V2_IDS) {
      expect(blueprints[id].blocks.length, `${id} 块数`).toBe(V2_BLOCK_COUNTS[id])
    }
  })

  it('每座坐标唯一、只使用 basic/window/gate、无完全悬空块', () => {
    for (const id of CONTENT_PACK_V2_IDS) {
      const blocks = blueprints[id].blocks
      const keys = blocks.map((block) => `${block.x},${block.y},${block.z}`)
      expect(new Set(keys).size, `${id} duplicate coords`).toBe(keys.length)
      const occupied = new Set(keys)
      const floating = blocks.filter((block) => isCompletelyFloating(block, occupied))
      expect(floating, `${id} floating: ${floating.map((b) => `${b.x},${b.y},${b.z}`).join(' ')}`).toEqual([])
      for (const block of blocks) {
        expect(['basic', 'window', 'gate'], `${id} bad type`).toContain(block.type)
      }
    }
  })

  it('每座自下而上排序（z 非递减），图鉴/建造页拼建顺序正确', () => {
    for (const id of CONTENT_PACK_V2_IDS) {
      const blocks = blueprints[id].blocks
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i].z, `${id} z order`).toBeGreaterThanOrEqual(blocks[i - 1].z)
      }
    }
  })

  it('新包总块数 600（仍在 400–600 区间）', () => {
    const total = CONTENT_PACK_V2_IDS.reduce((sum, id) => sum + blueprints[id].blocks.length, 0)
    expect(total).toBe(600)
    expect(total).toBeGreaterThanOrEqual(400)
    expect(total).toBeLessThanOrEqual(600)
  })

  it('装饰克制：每座仅少量 window/gate（不超过 8 处）', () => {
    for (const id of CONTENT_PACK_V2_IDS) {
      const decorated = blueprints[id].blocks.filter((block) => block.type !== 'basic').length
      expect(decorated, `${id} decorated blocks`).toBeGreaterThanOrEqual(1)
      expect(decorated, `${id} decorated blocks`).toBeLessThanOrEqual(8)
    }
  })
})

describe('内容包 v3 的 5 座结构（D-20261111-070）', () => {
  it('每座 80–120 块（与公开发布节奏一致）', () => {
    for (const id of CONTENT_PACK_V3_IDS) {
      const count = blueprints[id].blocks.length
      expect(count, `${id} blocks`).toBeGreaterThanOrEqual(80)
      expect(count, `${id} blocks`).toBeLessThanOrEqual(120)
    }
  })

  it('v3 逐座块数为权威值 98/104/92/112/94（合计 500）', () => {
    for (const id of CONTENT_PACK_V3_IDS) {
      expect(blueprints[id].blocks.length, `${id} 块数`).toBe(V3_BLOCK_COUNTS[id])
    }
    const total = CONTENT_PACK_V3_IDS.reduce((sum, id) => sum + blueprints[id].blocks.length, 0)
    expect(total).toBe(500)
    expect(total).toBeGreaterThanOrEqual(400)
    expect(total).toBeLessThanOrEqual(600)
  })

  it('每座 4–12 层（避免过矮/过高）', () => {
    for (const id of CONTENT_PACK_V3_IDS) {
      const layers = Math.max(...blueprints[id].blocks.map((block) => block.z)) + 1
      expect(layers, `${id} layers`).toBeGreaterThanOrEqual(4)
      expect(layers, `${id} layers`).toBeLessThanOrEqual(12)
    }
  })

  it('每座坐标唯一、只使用 basic/window/gate、无完全悬空块', () => {
    for (const id of CONTENT_PACK_V3_IDS) {
      const blocks = blueprints[id].blocks
      const keys = blocks.map((block) => `${block.x},${block.y},${block.z}`)
      expect(new Set(keys).size, `${id} duplicate coords`).toBe(keys.length)
      const occupied = new Set(keys)
      const floating = blocks.filter((block) => isCompletelyFloating(block, occupied))
      expect(floating, `${id} floating: ${floating.map((b) => `${b.x},${b.y},${b.z}`).join(' ')}`).toEqual([])
      for (const block of blocks) {
        expect(['basic', 'window', 'gate'], `${id} bad type`).toContain(block.type)
      }
    }
  })

  it('每座自下而上排序（z 非递减），拼建顺序正确', () => {
    for (const id of CONTENT_PACK_V3_IDS) {
      const blocks = blueprints[id].blocks
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i].z, `${id} z order`).toBeGreaterThanOrEqual(blocks[i - 1].z)
      }
    }
  })

  it('装饰克制：每座 3–10 处 window/gate', () => {
    for (const id of CONTENT_PACK_V3_IDS) {
      const decorated = blueprints[id].blocks.filter((block) => block.type !== 'basic').length
      expect(decorated, `${id} decorated blocks`).toBeGreaterThanOrEqual(3)
      expect(decorated, `${id} decorated blocks`).toBeLessThanOrEqual(10)
    }
  })

  it('全量 23 座 / 2485 块（基础 1385 + v2 600 + v3 500）', () => {
    const grandTotal = blueprintOrder.reduce((sum, id) => sum + blueprints[id].blocks.length, 0)
    expect(grandTotal).toBe(2485)
    expect(grandTotal).toBe(1385 + 600 + 500)
  })
})

describe('内容包解锁顺序（图鉴/建造动态化）', () => {
  it('基础 12 座全落成后：下一座 = v2 第一座，且新建筑可选', () => {
    const index = firstIncompleteIndex(BASE_ORDER)
    expect(index).toBe(12)
    expect(blueprintOrder[index]).toBe(CONTENT_PACK_V2_IDS[0])
    expect(canSelectBlueprint(CONTENT_PACK_V2_IDS[0], BASE_ORDER)).toBe(true)
    // 新包第二座还不能提前选（仍按顺序解锁）
    expect(canSelectBlueprint(CONTENT_PACK_V2_IDS[1], BASE_ORDER)).toBe(false)
  })

  it('v2 全部 18 座落成后：下一座 = v3 第一座，且 v3 建筑可选', () => {
    const afterV2 = [...BASE_ORDER, ...V2_ORDER]
    const index = firstIncompleteIndex(afterV2)
    expect(index).toBe(18)
    expect(blueprintOrder[index]).toBe(CONTENT_PACK_V3_IDS[0])
    expect(canSelectBlueprint(CONTENT_PACK_V3_IDS[0], afterV2)).toBe(true)
    expect(canSelectBlueprint(CONTENT_PACK_V3_IDS[1], afterV2)).toBe(false)
    // 未完成 v2 的用户看不到 v3 可选项
    expect(canSelectBlueprint(CONTENT_PACK_V3_IDS[0], BASE_ORDER)).toBe(false)
  })

  it('全部 23 座落成后：没有下一座（firstIncompleteIndex 越界），已完成建筑仍可查看', () => {
    const all = [...blueprintOrder]
    const nextIndex = firstIncompleteIndex(all)
    expect(nextIndex).toBe(blueprintOrder.length)
    expect(blueprintOrder[nextIndex]).toBeUndefined()
    // 已完成蓝图仍允许选中查看（不是"不可选"，而是没有"下一座"可推进）
    expect(canSelectBlueprint(CONTENT_PACK_V3_IDS[CONTENT_PACK_V3_IDS.length - 1], all)).toBe(true)
  })

  it('未完成早期内容的用户：后续内容包建筑仍不可选（继续按顺序建）', () => {
    const partial = BASE_ORDER.slice(0, 3)
    expect(canSelectBlueprint(CONTENT_PACK_V2_IDS[0], partial)).toBe(false)
    expect(canSelectBlueprint(BASE_ORDER[3], partial)).toBe(true)
    const afterV2Partial = [...BASE_ORDER, ...V2_ORDER.slice(0, 3)]
    expect(canSelectBlueprint(CONTENT_PACK_V3_IDS[0], afterV2Partial)).toBe(false)
    expect(canSelectBlueprint(CONTENT_PACK_V2_IDS[3], afterV2Partial)).toBe(true)
  })
})