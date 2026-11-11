import { describe, it, expect } from 'vitest'
import { blueprints, blueprintOrder } from './index'
import type { BlockDef } from '../../types'

function validateBlueprint(name: string, blocks: BlockDef[], cx: number, cy: number) {
  describe(`blueprint: ${name}`, () => {
    it('block count between 15 and 250', () => {
      expect(blocks.length).toBeGreaterThanOrEqual(15)
      expect(blocks.length).toBeLessThanOrEqual(250)
    })

    it('has no duplicate coordinates', () => {
      const keys = blocks.map((b) => `${b.x},${b.y},${b.z}`)
      expect(new Set(keys).size).toBe(keys.length)
    })

    // 允许 1 格同层悬挑（石拱桥拱肩），但禁止完全悬空孤岛：
    // 每块非底层积木必须「正下方有块」或「同层四邻有块」。
    it('has no completely floating blocks', () => {
      const occupied = new Set(blocks.map((b) => `${b.x},${b.y},${b.z}`))
      for (const b of blocks) {
        if (b.z === 0) continue
        const supported =
          occupied.has(`${b.x},${b.y},${b.z - 1}`) ||
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(([dx, dy]) => occupied.has(`${b.x + dx},${b.y + dy},${b.z}`))
        expect(supported, `block (${b.x},${b.y},${b.z}) floats`).toBe(true)
      }
    })

    it('is sorted bottom-up, inner-first', () => {
      for (let i = 1; i < blocks.length; i++) {
        const [a, b] = [blocks[i - 1], blocks[i]]
        if (a.z === b.z) {
          const da = Math.abs(a.x - cx) + Math.abs(a.y - cy)
          const db = Math.abs(b.x - cx) + Math.abs(b.y - cy)
          expect(da).toBeLessThanOrEqual(db)
        } else {
          expect(a.z).toBeLessThan(b.z)
        }
      }
    })

    it('only uses valid block types (basic/window/gate), no flags', () => {
      const types = new Set<string>(blocks.map((b) => b.type))
      for (const t of types) {
        expect(['basic', 'window', 'gate'].includes(t)).toBe(true)
      }
      expect(types.has('flag')).toBe(false)
    })
  })
}

const CENTERS: Record<string, [number, number]> = {
  // 内容包 v3（D-20261111-070）
  bakery: [2, 2],
  bookshop: [2, 2],
  postoffice: [3, 2],
  firestation: [3, 2],
  watertower: [2, 2],
  // 内容包 v2（D-20261110-063）
  treehouse: [4, 4],
  greenhouse: [3, 2],
  clocktower: [2, 2],
  bridge: [5, 1],
  observatory: [3, 3],
  library: [3, 2],
  plant: [1, 1],
  coffee: [1, 1],
  camera: [1, 1],
  windmill: [2, 2],
  cabin: [2, 2],
  rocket: [2, 2],
  lighthouse: [2, 2],
  factory: [5, 3],
  monument: [3, 3],
  pyramid: [4, 4],
  robot: [3, 1],
  castle: [4, 4],
}

describe('blueprint catalog', () => {
  it('has base 12 + content pack v2 6 + v3 5 in unlock order', () => {
    expect(blueprintOrder).toEqual([
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
      // 内容包 v2（追加，不改基础顺序）
      'treehouse',
      'greenhouse',
      'clocktower',
      'bridge',
      'observatory',
      'library',
      // 内容包 v3（D-20261111-070，追加，不改既有顺序）
      'bakery',
      'bookshop',
      'postoffice',
      'firestation',
      'watertower',
    ])
    expect(Object.keys(blueprints)).toHaveLength(blueprintOrder.length)
  })
})

for (const id of blueprintOrder) {
  const [cx, cy] = CENTERS[id]
  validateBlueprint(id, blueprints[id].blocks, cx, cy)
}