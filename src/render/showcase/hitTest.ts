/**
 * 展台沙盘的命中测试与坐标换算（纯拆分自 ShowcaseScene.tsx）：
 * 客户端坐标 → 世界坐标、会话旋转下的足迹兜底、从后往前的模型拾取。
 */
import type { Blueprint, ShowcasePlacement } from '../../types'
import { getRotatedFootprint, screenToGroundIso, type ModelFootprint } from '../../logic/showcase'
import type { IsoView } from '../iso'

/** 客户端坐标 → 画布局部世界坐标（pointer / touch 命中检测共用） */
export function clientToWorldPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  view: IsoView,
  tileH: number
): { worldPx: number; worldPy: number } {
  const mx = clientX - rect.left
  const my = clientY - rect.top
  return {
    worldPx: (mx - view.panX) / view.scale,
    worldPy: (my - view.panY) / view.scale - tileH / 2
  }
}

/** 会话旋转下的足迹：footprint 表缺失时按旋转现算（与旧实现同一兜底） */
export function resolveFootprint(
  bp: Blueprint,
  footprintMap: Map<string, ModelFootprint>,
  rotations: Record<string, number>,
  blueprintId: string
): ModelFootprint {
  return footprintMap.get(bp.id) ?? getRotatedFootprint(bp.blocks, rotations[blueprintId] ?? 0)
}

/** 世界坐标命中检测：从后往前找，落位 AABB 外扩 0.4 格 */
export function findModelAtWorldPoint(
  worldPx: number,
  worldPy: number,
  placements: ShowcasePlacement[],
  blueprintsMap: Record<string, Blueprint>,
  footprintMap: Map<string, ModelFootprint>,
  rotations: Record<string, number>,
  tileW: number,
  tileH: number
): string | null {
  const curPlacements = placements
  for (let i = curPlacements.length - 1; i >= 0; i--) {
    const p = curPlacements[i]
    const bp = blueprintsMap[p.blueprintId]
    if (!bp) continue
    // 命中检测每次 pointermove 都会跑；footprint 是纯派生值，用 memo 缓存而非重算
    const fp = resolveFootprint(bp, footprintMap, rotations, p.blueprintId)
    const { gx, gy } = screenToGroundIso(worldPx, worldPy, tileW, tileH)
    if (
      gx >= p.gridX - 0.4 &&
      gx <= p.gridX + fp.width + 0.4 &&
      gy >= p.gridY - 0.4 &&
      gy <= p.gridY + fp.depth + 0.4
    ) {
      return p.blueprintId
    }
  }
  return null
}
