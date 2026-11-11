import { describe, expect, it } from 'vitest'
import {
  buildBaseGeometry,
  buildFootprintMap,
  buildOffsetBlocksMap,
  buildRotatedFootprintMap,
  collectSortedCubes,
  compareCubes,
  rotateBlocksForRender,
} from './showcaseLayout'
import { getModelFootprint, getRotatedFootprint, SHOWCASE_GRID_SIZE } from '../logic/showcase'
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

/* ---------------- D-20261111-068 自由装饰模式：布局派生 ---------------- */

describe('rotateBlocksForRender（90° 象限旋转渲染派生）', () => {
  it('rotation=0 / 4 / -4 原样返回（引用稳定，旧输出逐字节不变）', () => {
    const blocks = blueprints.plant.blocks
    expect(rotateBlocksForRender(blocks, 0)).toBe(blocks)
    expect(rotateBlocksForRender(blocks, 4)).toBe(blocks)
    expect(rotateBlocksForRender(blocks, -4)).toBe(blocks)
    expect(rotateBlocksForRender(blocks)).toBe(blocks)
  })

  it('保留 z/type/color 与数组顺序（连击奖励 index 不错位），坐标归一化到 min 0', () => {
    const blocks = blueprints.camera.blocks
    const before = blocks.map((b) => ({ ...b }))
    const rotated = rotateBlocksForRender(blocks, 1)
    expect(rotated).toHaveLength(blocks.length)
    rotated.forEach((b, i) => {
      expect(b.z).toBe(blocks[i].z)
      expect(b.type).toBe(blocks[i].type)
      expect(b.color).toBe(blocks[i].color)
    })
    expect(Math.min(...rotated.map((b) => b.x))).toBe(0)
    expect(Math.min(...rotated.map((b) => b.y))).toBe(0)
    // 纯函数：不修改入参
    expect(blocks).toEqual(before)
  })

  it('90°/270° 宽深互换，180° 维持原足迹尺寸', () => {
    const blocks = blueprints.camera.blocks // 4×3
    const base = getModelFootprint(blocks)
    const fp1 = getModelFootprint(rotateBlocksForRender(blocks, 1))
    const fp2 = getModelFootprint(rotateBlocksForRender(blocks, 2))
    const fp3 = getModelFootprint(rotateBlocksForRender(blocks, 3))
    expect({ w: fp1.width, d: fp1.depth }).toEqual({ w: base.depth, d: base.width })
    expect({ w: fp2.width, d: fp2.depth }).toEqual({ w: base.width, d: base.depth })
    expect({ w: fp3.width, d: fp3.depth }).toEqual({ w: base.depth, d: base.width })
  })
})

describe('buildRotatedFootprintMap（会话旋转足迹表）', () => {
  it('空旋转时与旧 buildFootprintMap 完全一致', () => {
    const base = buildFootprintMap(map)
    const rotated = buildRotatedFootprintMap(map)
    expect([...rotated.keys()]).toEqual([...base.keys()])
    for (const [id, fp] of base) expect(rotated.get(id)).toEqual(fp)
    const zero = buildRotatedFootprintMap(map, { plant: 0 })
    for (const [id, fp] of base) expect(zero.get(id)).toEqual(fp)
  })

  it('90° 时宽深互换（camera 4×3 → 3×4）', () => {
    const cameraMap: Record<string, Blueprint> = { camera: blueprints.camera }
    const fpBase = buildFootprintMap(cameraMap).get('camera')!
    const fpRot = buildRotatedFootprintMap(cameraMap, { camera: 1 }).get('camera')!
    expect(fpRot.width).toBe(fpBase.depth)
    expect(fpRot.depth).toBe(fpBase.width)
    expect(fpRot).toEqual(getRotatedFootprint(blueprints.camera.blocks, 1))
  })
})

describe('collectSortedCubes / buildOffsetBlocksMap 的 rotations 参数', () => {
  const footprintMap = buildFootprintMap(map)

  it('rotations 缺省、空对象、显式全 0 时输出与旧实现完全一致', () => {
    const legacyCubes = collectSortedCubes(placements, map, footprintMap)
    expect(collectSortedCubes(placements, map, footprintMap, {})).toEqual(legacyCubes)
    expect(collectSortedCubes(placements, map, footprintMap, { plant: 0, coffee: 0 })).toEqual(
      legacyCubes,
    )

    const legacyOffsets = buildOffsetBlocksMap(placements, map, footprintMap)
    expect(buildOffsetBlocksMap(placements, map, footprintMap, {})).toEqual(legacyOffsets)
    expect(buildOffsetBlocksMap(placements, map, footprintMap, { plant: 0 })).toEqual(
      legacyOffsets,
    )
  })

  it('带旋转时块世界坐标 = 落位 + 旋转归一化块坐标，且仍全局有序', () => {
    const cubes = collectSortedCubes(placements, map, footprintMap, { plant: 1 })
    const total = map.plant.blocks.length + map.coffee.blocks.length
    expect(cubes).toHaveLength(total)
    for (let i = 1; i < cubes.length; i++) {
      expect(compareCubes(cubes[i - 1], cubes[i])).toBeLessThanOrEqual(0)
    }
    const plantRotated = rotateBlocksForRender(map.plant.blocks, 1)
    const plantCubes = cubes.filter((c) => c.blueprintId === 'plant')
    expect(plantCubes).toHaveLength(map.plant.blocks.length)
    const first = plantCubes.find((c) => c.index === 0)!
    expect(first.worldX).toBe(placements[0].gridX + plantRotated[0].x)
    expect(first.worldY).toBe(placements[0].gridY + plantRotated[0].y)
    // 未旋转的模型保持旧坐标
    const coffeeFp = footprintMap.get('coffee')!
    const coffeeBlock = map.coffee.blocks[0]
    const coffeeFirst = cubes.find((c) => c.blueprintId === 'coffee' && c.index === 0)!
    expect(coffeeFirst.worldX).toBe(placements[1].gridX + (coffeeBlock.x - coffeeFp.minX))
    expect(coffeeFirst.worldY).toBe(placements[1].gridY + (coffeeBlock.y - coffeeFp.minY))
  })

  it('带旋转的偏移块表与 collect 同源（阴影/植被/命中检测共用）', () => {
    const offsets = buildOffsetBlocksMap(placements, map, footprintMap, { plant: 1 })
    const rotated = rotateBlocksForRender(map.plant.blocks, 1)
    expect(offsets.get('plant')).toEqual(
      rotated.map((b) => ({ x: placements[0].gridX + b.x, y: placements[0].gridY + b.y })),
    )
    expect(offsets.get('plant')).toHaveLength(map.plant.blocks.length)
  })
})
