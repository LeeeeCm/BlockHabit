import type { BlockDef, Blueprint, ShowcasePlacement } from '../types'

export const SHOWCASE_GRID_SIZE = 26

export interface ModelFootprint {
  width: number
  depth: number
  minX: number
  minY: number
}

/** 计算模型在地平面上的占地矩形尺寸与局部偏移 */
export function getModelFootprint(blocks: BlockDef[]): ModelFootprint {
  if (blocks.length === 0) {
    return { width: 1, depth: 1, minX: 0, minY: 0 }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const b of blocks) {
    minX = Math.min(minX, b.x)
    maxX = Math.max(maxX, b.x)
    minY = Math.min(minY, b.y)
    maxY = Math.max(maxY, b.y)
  }
  return {
    width: maxX - minX + 1,
    depth: maxY - minY + 1,
    minX,
    minY,
  }
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  depth: number
}

/**
 * 2D 轴对齐包围盒 (AABB) 碰撞检测：
 * 两个建筑底座占地面积在水平 X 与 Y 上均存在交集时判定为重叠碰撞
 */
export function isAABBOverlapping(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.depth <= b.y ||
    b.y + b.depth <= a.y
  )
}

/** 校验模型是否可以在指定网格位置放置（无重叠且不超出展台边界） */
export function canPlaceModel(
  target: { blueprintId: string; gridX: number; gridY: number },
  existing: ShowcasePlacement[],
  blueprintsMap: Record<string, Blueprint>,
  gridSize: number = SHOWCASE_GRID_SIZE,
): boolean {
  const bp = blueprintsMap[target.blueprintId]
  if (!bp) return false

  const targetFp = getModelFootprint(bp.blocks)
  const targetBox: BoundingBox = {
    x: target.gridX,
    y: target.gridY,
    width: targetFp.width,
    depth: targetFp.depth,
  }

  // 1. 边界检测：必须完整容纳在展台基座网格内
  if (
    targetBox.x < 0 ||
    targetBox.y < 0 ||
    targetBox.x + targetBox.width > gridSize ||
    targetBox.y + targetBox.depth > gridSize
  ) {
    return false
  }

  // 2. 碰撞检测：与展台上其他已摆放建筑不得重叠
  for (const p of existing) {
    if (p.blueprintId === target.blueprintId) continue
    const otherBp = blueprintsMap[p.blueprintId]
    if (!otherBp) continue
    const otherFp = getModelFootprint(otherBp.blocks)
    const otherBox: BoundingBox = {
      x: p.gridX,
      y: p.gridY,
      width: otherFp.width,
      depth: otherFp.depth,
    }
    if (isAABBOverlapping(targetBox, otherBox)) {
      return false
    }
  }

  return true
}

/** 为新落成的建筑自动寻找展台上第一个空闲的无碰撞位置 */
export function findNextAvailablePlacement(
  blueprintId: string,
  existing: ShowcasePlacement[],
  blueprintsMap: Record<string, Blueprint>,
  gridSize: number = SHOWCASE_GRID_SIZE,
): ShowcasePlacement {
  const bp = blueprintsMap[blueprintId]
  if (!bp) return { blueprintId, gridX: 2, gridY: 2 }

  const fp = getModelFootprint(bp.blocks)

  // 预留边缘 1 格边距，由内至外寻找空位
  for (let y = 1; y <= gridSize - fp.depth - 1; y += 2) {
    for (let x = 1; x <= gridSize - fp.width - 1; x += 2) {
      if (canPlaceModel({ blueprintId, gridX: x, gridY: y }, existing, blueprintsMap, gridSize)) {
        return { blueprintId, gridX: x, gridY: y }
      }
    }
  }

  // 若带间隔位置已满，紧凑搜索每一个网格单元
  for (let y = 0; y <= gridSize - fp.depth; y++) {
    for (let x = 0; x <= gridSize - fp.width; x++) {
      if (canPlaceModel({ blueprintId, gridX: x, gridY: y }, existing, blueprintsMap, gridSize)) {
        return { blueprintId, gridX: x, gridY: y }
      }
    }
  }

  return { blueprintId, gridX: 0, gridY: 0 }
}

/**
 * 屏幕局部坐标 → 展台等距地面连续坐标（逆投影 Raycasting）：
 * x = (sx / tileW) + (sy / tileH)
 * y = (sy / tileH) - (sx / tileW)
 */
export function screenToGroundIso(
  sx: number,
  sy: number,
  tileW: number,
  tileH: number,
): { gx: number; gy: number } {
  const u = sx / tileW
  const v = sy / tileH
  return {
    gx: u + v,
    gy: v - u,
  }
}
