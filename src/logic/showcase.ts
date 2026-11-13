import type { BlockDef, Blueprint, ShowcasePlacement } from '../types'

export const SHOWCASE_GRID_SIZE = 26

/**
 * 装饰模式解锁（D-20261111-068）：completedBlueprintIds 覆盖 blueprintOrder 全部才解锁。
 * 蓝图总数动态取自传入的顺序表（内容包扩容后自动跟随），禁止硬编码数量。
 */
export function isDecorationUnlocked(
  completedIds: readonly string[],
  blueprintOrder: readonly string[]
): boolean {
  if (blueprintOrder.length === 0) return false
  const completed = new Set(completedIds)
  return blueprintOrder.every((id) => completed.has(id))
}

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
    minY
  }
}

/** 把任意整数旋转步进归一化到 0/1/2/3 象限（负数、超过一圈也能收敛） */
export function normalizeRotation(rotation: number): number {
  return ((Math.trunc(rotation) % 4) + 4) % 4
}

/**
 * 90° 象限旋转的整数格点坐标（D-20261111-068）：
 * 先做纯 90° 旋转（(x,y)->(y,-x) 等），再把包围盒平移归一化到 minX/minY=0，
 * 使旋转后的模型仍能以落位格点（gridX/gridY）为左上角参与碰撞与渲染。
 * 返回值与输入等长、顺序一致（只含 x/y，z / type / color 由调用方保留）。
 */
export function rotateBlockCoords(
  blocks: readonly BlockDef[],
  rotation: number
): Array<{ x: number; y: number }> {
  const q = normalizeRotation(rotation)
  const rotated = blocks.map((b) => {
    switch (q) {
      case 1:
        return { x: b.y, y: -b.x }
      case 2:
        return { x: -b.x, y: -b.y }
      case 3:
        return { x: -b.y, y: b.x }
      default:
        return { x: b.x, y: b.y }
    }
  })
  if (rotated.length === 0) return rotated
  let minX = Infinity
  let minY = Infinity
  for (const p of rotated) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
  }
  return rotated.map((p) => ({ x: p.x - minX, y: p.y - minY }))
}

/**
 * 旋转后的占地足迹：90°/270° 宽深互换；归一化后 minX/minY 恒为 0。
 * 空模型按 1×1 处理（与 getModelFootprint 一致）。
 */
export function getRotatedFootprint(blocks: readonly BlockDef[], rotation: number): ModelFootprint {
  const coords = rotateBlockCoords(blocks, rotation)
  if (coords.length === 0) return { width: 1, depth: 1, minX: 0, minY: 0 }
  let maxX = 0
  let maxY = 0
  for (const p of coords) {
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { width: maxX + 1, depth: maxY + 1, minX: 0, minY: 0 }
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

/**
 * 校验模型是否可以在指定网格位置放置（无重叠且不超出展台边界）。
 * rotations 为装饰模式的「本次会话 90° 象限」表（蓝图 id → 0/1/2/3，默认空 = 现状），
 * 目标与其它模型的占地均按各自当前旋转计算。
 */
export function canPlaceModel(
  target: { blueprintId: string; gridX: number; gridY: number },
  existing: ShowcasePlacement[],
  blueprintsMap: Record<string, Blueprint>,
  gridSize: number = SHOWCASE_GRID_SIZE,
  rotations: Record<string, number> = {}
): boolean {
  const bp = blueprintsMap[target.blueprintId]
  if (!bp) return false

  const targetFp = getRotatedFootprint(bp.blocks, rotations[target.blueprintId] ?? 0)
  const targetBox: BoundingBox = {
    x: target.gridX,
    y: target.gridY,
    width: targetFp.width,
    depth: targetFp.depth
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
    const otherFp = getRotatedFootprint(otherBp.blocks, rotations[p.blueprintId] ?? 0)
    const otherBox: BoundingBox = {
      x: p.gridX,
      y: p.gridY,
      width: otherFp.width,
      depth: otherFp.depth
    }
    if (isAABBOverlapping(targetBox, otherBox)) {
      return false
    }
  }

  return true
}

/**
 * 装饰模式旋转前置校验（D-20261111-068，纯函数）：
 * 旋转后的占地（宽深互换）不超出 SHOWCASE_GRID_SIZE，且不与其它模型 AABB 重叠。
 * 其它模型按其当前会话旋转计算；非法则调用方不应用旋转并提示 rotateBlocked。
 * 落位格点（gridX/gridY）保持不变——归一化到 minX/minY=0 后仍以该格点为左上角。
 */
export function canRotatePlacement(
  blueprintId: string,
  gridX: number,
  gridY: number,
  nextRotation: number,
  existing: readonly ShowcasePlacement[],
  blueprintsMap: Record<string, Blueprint>,
  rotations: Record<string, number> = {},
  gridSize: number = SHOWCASE_GRID_SIZE
): boolean {
  const bp = blueprintsMap[blueprintId]
  if (!bp) return false

  const fp = getRotatedFootprint(bp.blocks, nextRotation)
  const box: BoundingBox = { x: gridX, y: gridY, width: fp.width, depth: fp.depth }

  // 1. 边界检测：旋转后必须完整容纳在展台网格内
  if (box.x < 0 || box.y < 0 || box.x + box.width > gridSize || box.y + box.depth > gridSize) {
    return false
  }

  // 2. 碰撞检测：与其它已摆放模型的当前旋转占地不得重叠
  for (const p of existing) {
    if (p.blueprintId === blueprintId) continue
    const otherBp = blueprintsMap[p.blueprintId]
    if (!otherBp) continue
    const otherFp = getRotatedFootprint(otherBp.blocks, rotations[p.blueprintId] ?? 0)
    const otherBox: BoundingBox = {
      x: p.gridX,
      y: p.gridY,
      width: otherFp.width,
      depth: otherFp.depth
    }
    if (isAABBOverlapping(box, otherBox)) return false
  }

  return true
}

/** 为新落成的建筑自动寻找展台上第一个空闲的无碰撞位置 */
export function findNextAvailablePlacement(
  blueprintId: string,
  existing: ShowcasePlacement[],
  blueprintsMap: Record<string, Blueprint>,
  gridSize: number = SHOWCASE_GRID_SIZE
): ShowcasePlacement | null {
  const bp = blueprintsMap[blueprintId]
  if (!bp) return null

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

  // 展台已满：返回 null（调用方提示，而非静默重叠落位）
  return null
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
  tileH: number
): { gx: number; gy: number } {
  const u = sx / tileW
  const v = sy / tileH
  return {
    gx: u + v,
    gy: v - u
  }
}
