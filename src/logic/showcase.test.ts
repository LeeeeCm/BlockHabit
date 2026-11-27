import { describe, it, expect } from 'vitest'
import {
  getModelFootprint,
  getRotatedFootprint,
  isAABBOverlapping,
  canPlaceModel,
  canRotatePlacement,
  normalizeRotation,
  rotateBlockCoords,
  findNextAvailablePlacement,
  screenToGroundIso,
  createShowcaseSandbox,
  defaultSandboxDesign,
  normalizeSandboxDesign,
  rotationsFromPlacements,
  SHOWCASE_GRID_SIZE,
  SHOWCASE_SANDBOX_MAX
} from './showcase'
import { blueprints } from './blueprints'
import type { BlockDef, Blueprint, ShowcasePlacement } from '../types'

describe('showcase collision & layout logic', () => {
  it('getModelFootprint calculates width and depth from blocks', () => {
    const blocks: BlockDef[] = [
      { x: 2, y: 3, z: 0, type: 'basic' },
      { x: 4, y: 5, z: 1, type: 'basic' }
    ]
    const fp = getModelFootprint(blocks)
    expect(fp.width).toBe(3) // 4 - 2 + 1
    expect(fp.depth).toBe(3) // 5 - 3 + 1
    expect(fp.minX).toBe(2)
    expect(fp.minY).toBe(3)
  })

  it('isAABBOverlapping detects intersecting and separate boxes', () => {
    // 盒 A: [0, 2] x [0, 2] (3x3)
    const boxA = { x: 0, y: 0, width: 3, depth: 3 }
    // 盒 B 重叠于 (2,2)
    const boxB = { x: 2, y: 2, width: 3, depth: 3 }
    // 盒 C 位于 (4,4)，完全分离
    const boxC = { x: 4, y: 4, width: 3, depth: 3 }
    // 盒 D 贴边接触 (3, 0)，不重叠
    const boxD = { x: 3, y: 0, width: 3, depth: 3 }

    expect(isAABBOverlapping(boxA, boxB)).toBe(true)
    expect(isAABBOverlapping(boxA, boxC)).toBe(false)
    expect(isAABBOverlapping(boxA, boxD)).toBe(false)
  })

  it('canPlaceModel rejects out-of-bounds placements', () => {
    const existing: ShowcasePlacement[] = []
    // 仙人掌 3x3，放在 (SHOWCASE_GRID_SIZE - 1, SHOWCASE_GRID_SIZE - 1) 超出网格边界
    expect(
      canPlaceModel(
        { blueprintId: 'plant', gridX: SHOWCASE_GRID_SIZE - 1, gridY: SHOWCASE_GRID_SIZE - 1 },
        existing,
        blueprints,
        SHOWCASE_GRID_SIZE
      )
    ).toBe(false)
    expect(
      canPlaceModel(
        { blueprintId: 'plant', gridX: -1, gridY: 0 },
        existing,
        blueprints,
        SHOWCASE_GRID_SIZE
      )
    ).toBe(false)
    expect(
      canPlaceModel(
        { blueprintId: 'plant', gridX: 0, gridY: 0 },
        existing,
        blueprints,
        SHOWCASE_GRID_SIZE
      )
    ).toBe(true)
  })

  it('canPlaceModel rejects collisions between multiple models', () => {
    // 仙人掌 3x3 位于 (2, 2)
    const existing: ShowcasePlacement[] = [{ blueprintId: 'plant', gridX: 2, gridY: 2 }]
    // 试图在 (3, 3) 放置咖啡杯 (3x3) -> 发生碰撞
    expect(
      canPlaceModel(
        { blueprintId: 'coffee', gridX: 3, gridY: 3 },
        existing,
        blueprints,
        SHOWCASE_GRID_SIZE
      )
    ).toBe(false)
    // 放在 (6, 2) 无碰撞通过
    expect(
      canPlaceModel(
        { blueprintId: 'coffee', gridX: 6, gridY: 2 },
        existing,
        blueprints,
        SHOWCASE_GRID_SIZE
      )
    ).toBe(true)
  })

  it('findNextAvailablePlacement automatically finds non-overlapping spots', () => {
    const existing: ShowcasePlacement[] = [{ blueprintId: 'plant', gridX: 1, gridY: 1 }]
    const p = findNextAvailablePlacement('coffee', existing, blueprints, SHOWCASE_GRID_SIZE)
    expect(p).not.toBeNull()
    expect(canPlaceModel(p!, existing, blueprints, SHOWCASE_GRID_SIZE)).toBe(true)
    expect(p!.gridX).toBeGreaterThanOrEqual(0)
    expect(p!.gridY).toBeGreaterThanOrEqual(0)
  })

  it('screenToGroundIso reverses isometric projection accurately', () => {
    const tileW = 48
    const tileH = 24
    // 在 (x=2, y=3) 处:
    // sx = (2 - 3) * 24 = -24
    // sy = (2 + 3) * 12 = 60
    const sx = (2 - 3) * (tileW / 2)
    const sy = (2 + 3) * (tileH / 2)

    const unprojected = screenToGroundIso(sx, sy, tileW, tileH)
    expect(unprojected.gx).toBeCloseTo(2)
    expect(unprojected.gy).toBeCloseTo(3)
  })
})

/* ---------------- D-20261111-068 自由装饰模式：纯逻辑 ---------------- */

const block = (x: number, y: number, z = 0): BlockDef => ({ x, y, z, type: 'basic' })
const synth = (id: string, blocks: BlockDef[]): Blueprint => ({ id, blocks })
// 非方形合成蓝图：wide = 3×1、tall = 1×3，用于验证 90° 宽深互换与碰撞
const wide = synth('wide', [block(0, 0), block(1, 0), block(2, 0)])
const tall = synth('tall', [block(0, 0), block(0, 1), block(0, 2)])
const synthMap = { wide, tall }

describe('沙盘设计 / 旋转表派生（D-20261127-127）', () => {
  it('normalizeSandboxDesign 只接受四种设计，未知值回落 moss', () => {
    expect(normalizeSandboxDesign('moss')).toBe('moss')
    expect(normalizeSandboxDesign('stone')).toBe('stone')
    expect(normalizeSandboxDesign('bloom')).toBe('bloom')
    expect(normalizeSandboxDesign('bare')).toBe('bare')
    expect(normalizeSandboxDesign('unknown')).toBe('moss')
    expect(normalizeSandboxDesign(undefined)).toBe('moss')
  })

  it('defaultSandboxDesign 按序号轮换颜色方案', () => {
    expect(defaultSandboxDesign(0)).toBe('moss')
    expect(defaultSandboxDesign(1)).toBe('stone')
    expect(defaultSandboxDesign(2)).toBe('bloom')
    expect(defaultSandboxDesign(3)).toBe('bare')
    expect(defaultSandboxDesign(4)).toBe('moss')
  })

  it('createShowcaseSandbox 生成完整默认字段', () => {
    const sandbox = createShowcaseSandbox('sandbox-2', 1)
    expect(sandbox).toEqual({
      id: 'sandbox-2',
      placements: [],
      design: 'stone'
    })
    expect(SHOWCASE_SANDBOX_MAX).toBe(4)
  })

  it('rotationsFromPlacements 只收非 0 旋转并归一化', () => {
    expect(
      rotationsFromPlacements([
        { blueprintId: 'plant', gridX: 0, gridY: 0 },
        { blueprintId: 'coffee', gridX: 0, gridY: 0, rotation: 3 },
        { blueprintId: 'castle', gridX: 0, gridY: 0, rotation: 4 }
      ])
    ).toEqual({ coffee: 3 })
  })

  it('canPlaceModel 未显式传旋转表时，从 placements 的 rotation 派生', () => {
    // wide = 3×1；tall 转 90° 后变 3×1，会与 wide 重叠
    const existing: ShowcasePlacement[] = [{ blueprintId: 'tall', gridX: 0, gridY: 0, rotation: 1 }]
    expect(canPlaceModel({ blueprintId: 'wide', gridX: 1, gridY: 0 }, existing, synthMap, 26)).toBe(
      false
    )
    expect(
      canPlaceModel(
        { blueprintId: 'wide', gridX: 1, gridY: 0 },
        [{ blueprintId: 'tall', gridX: 0, gridY: 0 }],
        synthMap,
        26
      )
    ).toBe(true)
  })

  it('findNextAvailablePlacement 会把目标旋转写进返回的 placement', () => {
    const placement = findNextAvailablePlacement('wide', [], synthMap, 26, { wide: 1 })
    expect(placement).not.toBeNull()
    expect(placement?.rotation).toBe(1)
    // 旋转后 1×3，与 3×1 的首个空位不同
    const unrotated = findNextAvailablePlacement('wide', [], synthMap, 26)
    expect(unrotated?.rotation).toBeUndefined()
  })
})

describe('90° 象限旋转几何（整数格点 + bbox 归一化）', () => {
  it('normalizeRotation 收敛负数与多圈', () => {
    expect(normalizeRotation(0)).toBe(0)
    expect(normalizeRotation(4)).toBe(0)
    expect(normalizeRotation(5)).toBe(1)
    expect(normalizeRotation(-1)).toBe(3)
    expect(normalizeRotation(-6)).toBe(2)
  })

  it('rotateBlockCoords：(x,y)->(y,-x) 等纯旋转后再把 bbox 归一化到 minX/minY=0', () => {
    const blocks = [block(0, 0), block(1, 0), block(2, 0)]
    expect(rotateBlockCoords(blocks, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ])
    // 90°：三点变成同列，minY=-2 归一化后 y=2/1/0
    expect(rotateBlockCoords(blocks, 1)).toEqual([
      { x: 0, y: 2 },
      { x: 0, y: 1 },
      { x: 0, y: 0 }
    ])
    expect(rotateBlockCoords(blocks, 2)).toEqual([
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 }
    ])
    expect(rotateBlockCoords(blocks, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 }
    ])
  })

  it('非原点块也能归一化，且连续旋转 4 次回到原归一化坐标', () => {
    const blocks = [block(2, 3), block(4, 3), block(2, 6)]
    const at = (n: number) => {
      let cur = blocks
      for (let i = 0; i < n; i++) {
        const coords = rotateBlockCoords(cur, 1)
        cur = cur.map((b, i2) => ({ ...b, x: coords[i2].x, y: coords[i2].y }))
      }
      return cur.map(({ x, y }) => ({ x, y }))
    }
    expect(at(4)).toEqual(rotateBlockCoords(blocks, 0))
    expect(at(1)).toEqual(rotateBlockCoords(blocks, 1))
  })

  it('旋转后 footprint 宽深互换（90°/270° 互换，180° 保持）', () => {
    expect(getRotatedFootprint(wide.blocks, 0)).toMatchObject({ width: 3, depth: 1 })
    expect(getRotatedFootprint(wide.blocks, 1)).toMatchObject({ width: 1, depth: 3 })
    expect(getRotatedFootprint(wide.blocks, 2)).toMatchObject({ width: 3, depth: 1 })
    expect(getRotatedFootprint(wide.blocks, 3)).toMatchObject({ width: 1, depth: 3 })
    for (const rot of [0, 1, 2, 3]) {
      const fp = getRotatedFootprint(wide.blocks, rot)
      expect(fp.minX).toBe(0)
      expect(fp.minY).toBe(0)
    }
  })

  it('真实蓝图：camera 4×3 旋转 90° 后为 3×4', () => {
    const base = getModelFootprint(blueprints.camera.blocks)
    expect(base.width).toBe(4)
    expect(base.depth).toBe(3)
    const rotated = getRotatedFootprint(blueprints.camera.blocks, 1)
    expect(rotated.width).toBe(3)
    expect(rotated.depth).toBe(4)
  })

  it('空模型足迹按 1×1（不崩）', () => {
    expect(getRotatedFootprint([], 1)).toEqual({ width: 1, depth: 1, minX: 0, minY: 0 })
  })
})

describe('canRotatePlacement（旋转前校验：越界 / 邻居 AABB）', () => {
  it('旋转后仍在展台内则允许（宽深互换）', () => {
    const existing: ShowcasePlacement[] = [{ blueprintId: 'wide', gridX: 2, gridY: 2 }]
    expect(canRotatePlacement('wide', 2, 2, 0, existing, synthMap, {})).toBe(true)
    expect(canRotatePlacement('wide', 2, 2, 1, existing, synthMap, {})).toBe(true)
    expect(canRotatePlacement('wide', 2, 2, 3, existing, synthMap, {})).toBe(true)
    // 4 等价于 0
    expect(canRotatePlacement('wide', 2, 2, 4, existing, synthMap, {})).toBe(true)
  })

  it('旋转后超出 SHOWCASE_GRID_SIZE 则拒绝', () => {
    const tall5 = synth(
      'tall5',
      Array.from({ length: 5 }, (_, i) => block(0, i))
    )
    const map = { tall5 }
    const x = SHOWCASE_GRID_SIZE - 1
    const existing: ShowcasePlacement[] = [{ blueprintId: 'tall5', gridX: x, gridY: 0 }]
    // 1×5 贴右边界合法；旋转成 5×1 后 x+5 越界
    expect(canRotatePlacement('tall5', x, 0, 0, existing, map, {})).toBe(true)
    expect(canRotatePlacement('tall5', x, 0, 1, existing, map, {})).toBe(false)
    // 贴底边同理：5×1 的 wide5 旋转成 1×5 后 y+5 越界
    const wide5 = synth(
      'wide5',
      Array.from({ length: 5 }, (_, i) => block(i, 0))
    )
    const mapBottom = { wide5 }
    const y = SHOWCASE_GRID_SIZE - 1
    const atBottom: ShowcasePlacement[] = [{ blueprintId: 'wide5', gridX: 0, gridY: y }]
    expect(canRotatePlacement('wide5', 0, y, 0, atBottom, mapBottom, {})).toBe(true)
    expect(canRotatePlacement('wide5', 0, y, 1, atBottom, mapBottom, {})).toBe(false)
  })

  it('与邻居 AABB 重叠则拒绝；邻居按自己的当前会话旋转计算', () => {
    // wide(3×1) 在 (2,2)，邻居 tall(1×3) 在 (0,2)：互不接触
    const existing: ShowcasePlacement[] = [
      { blueprintId: 'wide', gridX: 2, gridY: 2 },
      { blueprintId: 'tall', gridX: 0, gridY: 2 }
    ]
    // 邻居 0°：tall 占 x∈[0,1)，wide 转 90° 后占 x∈[2,3) → 不重叠，允许
    expect(canRotatePlacement('wide', 2, 2, 1, existing, synthMap, {})).toBe(true)
    // 邻居转 90° 后 tall 变 3×1 占 x∈[0,3) → 与 wide 转 90° 后的 x∈[2,3) 重叠，拒绝
    expect(canRotatePlacement('wide', 2, 2, 1, existing, synthMap, { tall: 1 })).toBe(false)
  })

  it('未知蓝图拒绝（脏数据不崩）', () => {
    expect(canRotatePlacement('ghost', 0, 0, 1, [], synthMap, {})).toBe(false)
  })
})

describe('canPlaceModel 的会话旋转参数（拖拽校验复用）', () => {
  it('其它模型按当前会话旋转计算 AABB', () => {
    const existing: ShowcasePlacement[] = [{ blueprintId: 'tall', gridX: 0, gridY: 2 }]
    // tall 0°：占 x=0 一列，与 wide 在 x=2 不冲突
    expect(
      canPlaceModel(
        { blueprintId: 'wide', gridX: 2, gridY: 2 },
        existing,
        synthMap,
        SHOWCASE_GRID_SIZE,
        {}
      )
    ).toBe(true)
    // tall 转 90°：变 3×1 占 x∈[0,3)，与 wide 的 x∈[2,5) 重叠
    expect(
      canPlaceModel(
        { blueprintId: 'wide', gridX: 2, gridY: 2 },
        existing,
        synthMap,
        SHOWCASE_GRID_SIZE,
        {
          tall: 1
        }
      )
    ).toBe(false)
  })
})
