/**
 * 桌宠窗口的纯几何与节奏（D-20261124-088）。
 * 不碰 DOM / Tauri，便于单测覆盖碰边、钳制与随机间隔。
 */

export interface PetPoint {
  x: number
  y: number
}

export interface PetWorkArea {
  x: number
  y: number
  width: number
  height: number
}

/** 宠物窗口逻辑尺寸（与 tauri.conf.json 的 pet 窗口保持一致） */
export const PET_SIZE = { w: 96, h: 128 } as const

export function clampPetPosition(
  pos: PetPoint,
  area: PetWorkArea,
  size = PET_SIZE,
  margin = 8
): PetPoint {
  const minX = area.x + margin
  const minY = area.y + margin
  const maxX = area.x + area.width - size.w - margin
  const maxY = area.y + area.height - size.h - margin
  return {
    x: Math.round(Math.min(Math.max(pos.x, minX), Math.max(minX, maxX))),
    y: Math.round(Math.min(Math.max(pos.y, minY), Math.max(minY, maxY)))
  }
}

/** 默认停在当前工作区右下角，离任务栏 16px */
export function defaultPetPosition(area: PetWorkArea, size = PET_SIZE, margin = 16): PetPoint {
  return {
    x: Math.round(area.x + area.width - size.w - margin),
    y: Math.round(area.y + area.height - size.h - margin)
  }
}

/** 单步水平行走；碰到工作区边缘时反向，返回一步后的位置与新方向 */
export function stepPetWalk(
  pos: PetPoint,
  direction: -1 | 1,
  distance: number,
  area: PetWorkArea,
  size = PET_SIZE,
  margin = 8
): { pos: PetPoint; direction: -1 | 1 } {
  const minX = area.x + margin
  const maxX = area.x + area.width - size.w - margin
  let x = pos.x + direction * distance
  let nextDirection = direction
  if (x <= minX) {
    x = minX
    nextDirection = 1
  } else if (x >= maxX) {
    x = maxX
    nextDirection = -1
  }
  return {
    pos: clampPetPosition({ x, y: pos.y }, area, size, margin),
    direction: nextDirection
  }
}

/** 下一次「开始走动 / 停下」的间隔：6–16 秒，让桌宠以待机动作为主 */
export function nextMoveDelay(random: () => number = Math.random): number {
  return 6000 + Math.round(random() * 10000)
}
