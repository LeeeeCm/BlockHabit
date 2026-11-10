import { describe, expect, it } from 'vitest'
import type { BlockDef } from '../../types'
import { getTranslation } from '../../i18n'
import { BLUEPRINT_CAPACITY } from '../builds'
import { canSelectBlueprint, firstIncompleteIndex } from '../blueprint'
import { blueprintOrder, blueprints } from './index'
import { CONTENT_PACKS, CONTENT_PACK_V2_IDS, CONTENT_VERSION } from './manifest'
import { APPROVED_BLUEPRINT_COLORS } from './palette'

/**
 * B1 内容包（D-20261110-063）+ 蓝图色彩系统（D-20261111-067）构建期校验：
 * manifest 与注册表一致、内容包 v2 的 6 座结构合法（块数/唯一/可支撑/命名）、
 * 既有 12 座**几何/块数/顺序零改动**（D-067 只允许颜色字段变化，且必须用批准色板）、
 * 解锁顺序自动指向新包。
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

const ZH = getTranslation('zh')
const EN = getTranslation('en')

describe('内容包 manifest（B1）', () => {
  it('CONTENT_VERSION = 2，包含 base(v1) 与 city-life(v2) 两个内容包', () => {
    expect(CONTENT_VERSION).toBe(2)
    expect(CONTENT_PACKS.map((pack) => pack.id)).toEqual(['base', 'city-life'])
    expect(CONTENT_PACKS.map((pack) => pack.version)).toEqual([1, 2])
    expect(CONTENT_PACKS.map((pack) => pack.version).sort()).toEqual([1, CONTENT_VERSION])
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
    const v2 = CONTENT_PACKS.find((pack) => pack.version === 2)
    expect(v2?.blueprintIds).toEqual([...(CONTENT_PACK_V2_IDS as string[])])
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

  it('18 座使用的颜色全部来自 D-067 批准材质调色板（含基础 12 座的新配色）', () => {
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
  it('order 内 id 唯一，全部注册且 id 与键一致', () => {
    expect(new Set(blueprintOrder).size).toBe(blueprintOrder.length)
    expect(Object.keys(blueprints)).toHaveLength(blueprintOrder.length)
    for (const id of blueprintOrder) {
      expect(blueprints[id], `blueprint ${id} missing`).toBeDefined()
      expect(blueprints[id].id).toBe(id)
    }
  })

  it('新增 6 座蓝图顺序追加在基础 12 座之后', () => {
    expect(CONTENT_PACK_V2_IDS).toHaveLength(6)
    expect(blueprintOrder.slice(12)).toEqual([...CONTENT_PACK_V2_IDS])
    for (const id of CONTENT_PACK_V2_IDS) expect(BASE_ORDER).not.toContain(id)
  })

  it('容量表由注册表自动派生（每座容量 = blocks.length）', () => {
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

  it('新包总块数 600（D-067 后为 594+6；仍在 400–600 区间）', () => {
    const total = CONTENT_PACK_V2_IDS.reduce((sum, id) => sum + blueprints[id].blocks.length, 0)
    expect(total).toBe(600)
    expect(total).toBeGreaterThanOrEqual(400)
    expect(total).toBeLessThanOrEqual(600)
    // 全量 18 座 = 基础 1385 + 内容包 600
    const grandTotal = blueprintOrder.reduce((sum, id) => sum + blueprints[id].blocks.length, 0)
    expect(grandTotal).toBe(1985)
  })

  it('装饰克制：每座仅少量 window/gate（不超过 8 处）', () => {
    for (const id of CONTENT_PACK_V2_IDS) {
      const decorated = blueprints[id].blocks.filter((block) => block.type !== 'basic').length
      expect(decorated, `${id} decorated blocks`).toBeGreaterThanOrEqual(1)
      expect(decorated, `${id} decorated blocks`).toBeLessThanOrEqual(8)
    }
  })
})

describe('内容包解锁顺序（图鉴/建造动态化）', () => {
  it('基础 12 座全落成后：下一座 = 新包第一座，且新建筑可选', () => {
    const index = firstIncompleteIndex(BASE_ORDER)
    expect(index).toBe(12)
    expect(blueprintOrder[index]).toBe(CONTENT_PACK_V2_IDS[0])
    expect(canSelectBlueprint(CONTENT_PACK_V2_IDS[0], BASE_ORDER)).toBe(true)
    // 新包第二座还不能提前选（仍按顺序解锁）
    expect(canSelectBlueprint(CONTENT_PACK_V2_IDS[1], BASE_ORDER)).toBe(false)
  })

  it('全部 18 座落成后：没有下一座（firstIncompleteIndex 越界），已完成建筑仍可查看', () => {
    const all = [...blueprintOrder]
    const nextIndex = firstIncompleteIndex(all)
    expect(nextIndex).toBe(blueprintOrder.length)
    expect(blueprintOrder[nextIndex]).toBeUndefined()
    // 已完成蓝图仍允许选中查看（不是"不可选"，而是没有"下一座"可推进）
    expect(canSelectBlueprint(CONTENT_PACK_V2_IDS[CONTENT_PACK_V2_IDS.length - 1], all)).toBe(true)
  })

  it('未完成基础包的用户：新包建筑仍不可选（继续按顺序建）', () => {
    const partial = BASE_ORDER.slice(0, 3)
    expect(canSelectBlueprint(CONTENT_PACK_V2_IDS[0], partial)).toBe(false)
    expect(canSelectBlueprint(BASE_ORDER[3], partial)).toBe(true)
  })
})
