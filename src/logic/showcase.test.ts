import { describe, it, expect } from 'vitest'
import {
  getModelFootprint,
  isAABBOverlapping,
  canPlaceModel,
  findNextAvailablePlacement,
  screenToGroundIso,
  SHOWCASE_GRID_SIZE,
} from './showcase'
import { blueprints } from './blueprints'
import type { BlockDef, ShowcasePlacement } from '../types'

describe('showcase collision & layout logic', () => {
  it('getModelFootprint calculates width and depth from blocks', () => {
    const blocks: BlockDef[] = [
      { x: 2, y: 3, z: 0, type: 'basic' },
      { x: 4, y: 5, z: 1, type: 'basic' },
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
    expect(canPlaceModel({ blueprintId: 'plant', gridX: SHOWCASE_GRID_SIZE - 1, gridY: SHOWCASE_GRID_SIZE - 1 }, existing, blueprints, SHOWCASE_GRID_SIZE)).toBe(false)
    expect(canPlaceModel({ blueprintId: 'plant', gridX: -1, gridY: 0 }, existing, blueprints, SHOWCASE_GRID_SIZE)).toBe(false)
    expect(canPlaceModel({ blueprintId: 'plant', gridX: 0, gridY: 0 }, existing, blueprints, SHOWCASE_GRID_SIZE)).toBe(true)
  })

  it('canPlaceModel rejects collisions between multiple models', () => {
    // 仙人掌 3x3 位于 (2, 2)
    const existing: ShowcasePlacement[] = [{ blueprintId: 'plant', gridX: 2, gridY: 2 }]
    // 试图在 (3, 3) 放置咖啡杯 (3x3) -> 发生碰撞
    expect(canPlaceModel({ blueprintId: 'coffee', gridX: 3, gridY: 3 }, existing, blueprints, SHOWCASE_GRID_SIZE)).toBe(false)
    // 放在 (6, 2) 无碰撞通过
    expect(canPlaceModel({ blueprintId: 'coffee', gridX: 6, gridY: 2 }, existing, blueprints, SHOWCASE_GRID_SIZE)).toBe(true)
  })

  it('findNextAvailablePlacement automatically finds non-overlapping spots', () => {
    const existing: ShowcasePlacement[] = [
      { blueprintId: 'plant', gridX: 1, gridY: 1 },
    ]
    const p = findNextAvailablePlacement('coffee', existing, blueprints, SHOWCASE_GRID_SIZE)
    expect(canPlaceModel(p, existing, blueprints, SHOWCASE_GRID_SIZE)).toBe(true)
    expect(p.gridX).toBeGreaterThanOrEqual(0)
    expect(p.gridY).toBeGreaterThanOrEqual(0)
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
