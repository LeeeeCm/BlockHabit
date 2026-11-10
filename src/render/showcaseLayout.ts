import type { Blueprint, ShowcasePlacement } from '../types'
import { getModelFootprint, type ModelFootprint } from '../logic/showcase'
import { worldToScreen, type IsoConfig } from './iso'

/**
 * 展台沙盘的纯几何派生（E5 拆分自 ShowcaseScene.tsx）：
 * 底座曲线采样、模型足迹表、全局遮挡排序的积木列表、带落位偏移的积木坐标。
 * 全部是 placements / blueprints 的纯函数，可单测、不碰 canvas。
 */

export interface RenderCube {
  worldX: number
  worldY: number
  worldZ: number
  block: Blueprint['blocks'][0]
  blueprintId: string
  isDragging: boolean
  /** 蓝图内序位（= PlacedBlock.index），用于取连击奖励 bonus 标记 */
  index?: number
}

/** Painter's 遮挡比较器：先按 (x+y) 深度，再按 z 高度 */
export function compareCubes(a: RenderCube, b: RenderCube): number {
  const da = a.worldX + a.worldY
  const db = b.worldX + b.worldY
  if (da !== db) return da - db
  return a.worldZ - b.worldZ
}

export interface BaseGeometry {
  topPts: Array<{ sx: number; sy: number }>
  botPts: Array<{ sx: number; sy: number }>
  skirtPts: Array<{ sx: number; sy: number }>
}

/** 静态实木沙盘底托曲线采样点（纯几何静态，不随帧刷新） */
export function buildBaseGeometry(cfg: IsoConfig, G: number): BaseGeometry {
  const slabH = 12
  const radii = { bottom: 2.6, side: 2.1, top: 1.7 }
  const STEPS = 20
  const topPts: BaseGeometry['topPts'] = []
  const botPts: BaseGeometry['botPts'] = []
  const addSample = (gx: number, gy: number) => {
    const s = worldToScreen(gx, gy, 0, cfg)
    topPts.push({ sx: s.sx, sy: s.sy + cfg.tileH / 2 })
    botPts.push({ sx: s.sx, sy: s.sy + cfg.tileH / 2 + slabH })
  }

  const { top: rt, side: rs, bottom: rb } = radii
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    addSample(rt - rt * Math.cos(a), rt - rt * Math.sin(a))
  }
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    addSample(G - rs + rs * Math.sin(a), rs - rs * Math.cos(a))
  }
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    addSample(G - rb + rb * Math.cos(a), G - rb + rb * Math.sin(a))
  }
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    addSample(rs - rs * Math.sin(a), G - rs + rs * Math.cos(a))
  }

  let leftIdx = 0
  let rightIdx = 0
  for (let i = 1; i < topPts.length; i++) {
    if (topPts[i].sx < topPts[leftIdx].sx) leftIdx = i
    if (topPts[i].sx > topPts[rightIdx].sx) rightIdx = i
  }

  const skirtPts: BaseGeometry['skirtPts'] = []
  if (leftIdx > rightIdx) {
    for (let i = rightIdx; i <= leftIdx; i++) skirtPts.push(topPts[i])
    for (let i = leftIdx; i >= rightIdx; i--) skirtPts.push(botPts[i])
  }

  return { topPts, botPts, skirtPts }
}

/** 蓝图模型足迹表（蓝图不变时引用稳定） */
export function buildFootprintMap(
  blueprintsMap: Record<string, Blueprint>
): Map<string, ModelFootprint> {
  const map = new Map<string, ModelFootprint>()
  for (const [id, bp] of Object.entries(blueprintsMap)) {
    map.set(id, getModelFootprint(bp.blocks))
  }
  return map
}

/**
 * 静态排序列表：所有模型按当前落位展开并按画家算法排好序。
 * 拖拽时只与被拖模型做双有序归并，不再每帧全量重建 + 全量排序。
 */
export function collectSortedCubes(
  placements: ShowcasePlacement[],
  blueprintsMap: Record<string, Blueprint>,
  footprintMap: Map<string, ModelFootprint>
): RenderCube[] {
  const cubes: RenderCube[] = []
  for (const p of placements) {
    const bp = blueprintsMap[p.blueprintId]
    if (!bp) continue
    const fp = footprintMap.get(bp.id) ?? getModelFootprint(bp.blocks)
    bp.blocks.forEach((b, index) => {
      cubes.push({
        worldX: p.gridX + (b.x - fp.minX),
        worldY: p.gridY + (b.y - fp.minY),
        worldZ: b.z,
        block: b,
        blueprintId: p.blueprintId,
        isDragging: false,
        index
      })
    })
  }
  cubes.sort(compareCubes)
  return cubes
}

/** 已落位模型的偏移积木坐标（阴影/植被绘制与命中检测共用） */
export function buildOffsetBlocksMap(
  placements: ShowcasePlacement[],
  blueprintsMap: Record<string, Blueprint>,
  footprintMap: Map<string, ModelFootprint>
): Map<string, Array<{ x: number; y: number }>> {
  const map = new Map<string, Array<{ x: number; y: number }>>()
  for (const p of placements) {
    const bp = blueprintsMap[p.blueprintId]
    if (!bp) continue
    const fp = footprintMap.get(bp.id) ?? getModelFootprint(bp.blocks)
    map.set(
      p.blueprintId,
      bp.blocks.map((b) => ({ x: p.gridX + (b.x - fp.minX), y: p.gridY + (b.y - fp.minY) }))
    )
  }
  return map
}
