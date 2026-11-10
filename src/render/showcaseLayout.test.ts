import { describe, expect, it } from 'vitest'
import {
  buildBaseGeometry,
  buildFootprintMap,
  buildOffsetBlocksMap,
  collectSortedCubes,
  compareCubes,
} from './showcaseLayout'
import { getModelFootprint, SHOWCASE_GRID_SIZE } from '../logic/showcase'
import { DEFAULT_ISO_CONFIG } from './isoGeometry'
import { blueprints } from '../logic/blueprints'
import type { Blueprint, ShowcasePlacement } from '../types'

/**
 * D-20261110-045：展台沙盘的纯几何派生（E5 拆分自 ShowcaseScene.tsx）。
 * 这些函数决定「模型摆在哪、谁遮住谁、阴影画在哪」，此前无单测。
 */
const map = { plant: blueprints.plant, coffee: blueprints.coffee }
const placements: ShowcasePlacement[] = [
  { blueprintId: 'plant', gridX: 2, gridY: 3 },
  { blueprintId: 'coffee', gridX: 8, gridY: 1 },
]

describe('compareCubes（画家算法）', () => {
  const cube = (worldX: number, worldY: number, worldZ: number) => ({
    worldX, worldY, worldZ, block: blueprints.plant.blocks[0], blueprintId: 'plant', isDragging: false,
  })

  it('先比 (x+y) 深度', () => {
    expect(compareCubes(cube(0, 0, 0), cube(2, 1, 0))).toBeLessThan(0)
  })

  it('深度相同再比 z（高处后画）', () => {
    expect(compareCubes(cube(1, 1, 2), cube(1, 1, 0))).toBeGreaterThan(0)
    expect(compareCubes(cube(1, 1, 1), cube(1, 1, 1))).toBe(0)
  })
})

describe('collectSortedCubes', () => {
  it('按落位偏移展开每个模型的块，并保持全局有序', () => {
    const footprintMap = buildFootprintMap(map)
    const cubes = collectSortedCubes(placements, map, footprintMap)
    const total = map.plant.blocks.length + map.coffee.blocks.length
    expect(cubes).toHaveLength(total)
    for (let i = 1; i < cubes.length; i++) {
      expect(compareCubes(cubes[i - 1], cubes[i])).toBeLessThanOrEqual(0)
    }
  })

  it('块坐标 = 落位 + (块 - 足迹最小角)，保证模型左上角对齐格点', () => {
    const footprintMap = buildFootprintMap(map)
    const cubes = collectSortedCubes([placements[0]], map, footprintMap)
    const fp = getModelFootprint(blueprints.plant.blocks)
    const block = blueprints.plant.blocks[0]
    const target = cubes.find((c) => c.index === 0)!
    expect(target.worldX).toBe(placements[0].gridX + (block.x - fp.minX))
    expect(target.worldY).toBe(placements[0].gridY + (block.y - fp.minY))
  })

  it('未知蓝图被跳过（脏数据不崩）', () => {
    const cubes = collectSortedCubes([{ blueprintId: 'nope', gridX: 0, gridY: 0 }], map, buildFootprintMap(map))
    expect(cubes).toEqual([])
  })
})

describe('buildOffsetBlocksMap', () => {
  it('每个已落位模型一份偏移块坐标，长度等于蓝图块数', () => {
    const m = buildOffsetBlocksMap(placements, map, buildFootprintMap(map))
    expect(m.size).toBe(2)
    expect(m.get('plant')).toHaveLength(map.plant.blocks.length)
    expect(m.get('coffee')).toHaveLength(map.coffee.blocks.length)
  })
})

describe('buildBaseGeometry', () => {
  const G = SHOWCASE_GRID_SIZE
  const geo = buildBaseGeometry(DEFAULT_ISO_CONFIG, G)

  it('四条圆角边各采样 STEPS+1 个点（上/下面对应）', () => {
    expect(geo.topPts).toHaveLength(4 * 21)
    expect(geo.botPts).toHaveLength(geo.topPts.length)
  })

  it('底面点严格位于顶面点下方一个板厚（12px）', () => {
    for (let i = 0; i < geo.topPts.length; i++) {
      expect(geo.botPts[i].sx).toBeCloseTo(geo.topPts[i].sx, 10)
      expect(geo.botPts[i].sy - geo.topPts[i].sy).toBeCloseTo(12, 10)
    }
  })

  it('裙边由「顶面从左到右 + 底面从右到左」组成（闭合环）', () => {
    expect(geo.skirtPts.length).toBeGreaterThan(0)
    expect(geo.skirtPts.length % 2).toBe(0)
    const half = geo.skirtPts.length / 2
    for (let i = 0; i < half; i++) {
      expect(geo.skirtPts[i].sx).toBeCloseTo(geo.skirtPts[geo.skirtPts.length - 1 - i].sx, 10)
    }
  })

  it('采样点落在沙盘范围内（含圆角内缩）', () => {
    const halfW = (G * DEFAULT_ISO_CONFIG.tileW) / 2
    for (const p of geo.topPts) expect(Math.abs(p.sx)).toBeLessThanOrEqual(halfW + 1e-6)
  })

  it('纯函数：同参数返回等价结果（不共享可变状态）', () => {
    const a = buildBaseGeometry(DEFAULT_ISO_CONFIG, G)
    expect(a.topPts).toEqual(geo.topPts)
  })
})

describe('buildFootprintMap', () => {
  it('覆盖传入的全部蓝图', () => {
    const m: Record<string, Blueprint> = { plant: blueprints.plant }
    expect([...buildFootprintMap(m).keys()]).toEqual(['plant'])
  })
})
