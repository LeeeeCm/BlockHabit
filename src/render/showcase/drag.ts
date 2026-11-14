/**
 * 展台沙盘的拖拽数学（纯拆分自 ShowcaseScene.tsx）：
 * 拖拽状态类型、磁吸对齐、拖拽积木展开与双有序归并。状态编排仍留在组件。
 */
import type { Blueprint } from '../../types'
import type { ModelFootprint } from '../../logic/showcase'
import { compareCubes, rotateBlocksForRender, type RenderCube } from '../showcaseLayout'

export interface DragState {
  blueprintId: string
  startGx: number
  startGy: number
  currentGx: number
  currentGy: number
  isValid: boolean
  hasMoved: boolean
  downPx: number
  downPy: number
}

/** 磁吸对齐至整数网格坐标（钳制在展台内） */
export function snapDragTarget(
  gx: number,
  gy: number,
  fp: Pick<ModelFootprint, 'width' | 'depth'>,
  G: number
): { targetGx: number; targetGy: number } {
  return {
    targetGx: Math.max(0, Math.min(G - fp.width, Math.round(gx - fp.width / 2))),
    targetGy: Math.max(0, Math.min(G - fp.depth, Math.round(gy - fp.depth / 2)))
  }
}

/** 拖拽中的模型积木：按当前会话旋转展开并做画家算法排序 */
export function buildDragCubes(
  bp: Blueprint,
  fp: ModelFootprint,
  dragRotation: number,
  drag: DragState
): RenderCube[] {
  const dragBlocks = rotateBlocksForRender(bp.blocks, dragRotation)
  const dragCubes: RenderCube[] = []
  for (const b of dragBlocks) {
    dragCubes.push({
      worldX: drag.currentGx + (b.x - fp.minX),
      worldY: drag.currentGy + (b.y - fp.minY),
      worldZ: b.z,
      block: b,
      blueprintId: drag.blueprintId,
      isDragging: true
    })
  }
  dragCubes.sort(compareCubes)
  return dragCubes
}

/** 拖拽时剔除被拖模型后，与拖拽有序列表做线性归并（O(n) 替代每帧全量重建 + 排序） */
export function mergeDragCubes(
  staticCubes: RenderCube[],
  dragCubes: RenderCube[],
  dragBlueprintId: string
): RenderCube[] {
  const merged: RenderCube[] = []
  let i = 0
  let j = 0
  while (i < staticCubes.length && j < dragCubes.length) {
    const s = staticCubes[i]
    if (s.blueprintId === dragBlueprintId) {
      i++
      continue
    }
    const d = dragCubes[j]
    if (compareCubes(s, d) <= 0) {
      merged.push(s)
      i++
    } else {
      merged.push(d)
      j++
    }
  }
  while (i < staticCubes.length) {
    const s = staticCubes[i++]
    if (s.blueprintId !== dragBlueprintId) merged.push(s)
  }
  while (j < dragCubes.length) merged.push(dragCubes[j++])
  return merged
}
