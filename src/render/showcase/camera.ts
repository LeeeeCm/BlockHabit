/**
 * 展台沙盘的相机约束（纯拆分自 ShowcaseScene.tsx）：
 * 初始取景、以光标/双指中心为焦点的缩放与视图平移公式。
 */
import { worldToScreen, type IsoConfig, type IsoView } from '../iso'
import { clampZoom } from '../touchGesture'

/** 初始取景：展台整体居中（视口 48px 内边距，最大 1.2 倍） */
export function fitShowcaseView(
  w: number,
  h: number,
  cfg: IsoConfig,
  G: number
): IsoView & { fitted: boolean } {
  const p0 = worldToScreen(0, 0, 0, cfg)
  const pXY = worldToScreen(G, G, 0, cfg)
  const sceneW = G * cfg.tileW
  const sceneH = G * cfg.tileH + 120
  const scale = Math.min((w - 48) / sceneW, (h - 48) / sceneH, 1.2)
  return {
    scale,
    panX: w / 2 - ((p0.sx + pXY.sx) / 2) * scale,
    panY: h / 2 - ((p0.sy + pXY.sy) / 2) * scale - 20,
    fitted: true
  }
}

/** 焦点缩放：保持 (mx, my) 下的世界坐标不动 */
function zoomViewAt(view: IsoView, mx: number, my: number, nextScale: number): void {
  view.panX = mx - ((mx - view.panX) / view.scale) * nextScale
  view.panY = my - ((my - view.panY) / view.scale) * nextScale
  view.scale = nextScale
}

/** 滚轮缩放：1.1 倍步进，钳制 [0.4, 2.5] */
export function applyWheelZoom(view: IsoView, mx: number, my: number, deltaY: number): void {
  const factor = deltaY < 0 ? 1.1 : 1 / 1.1
  const next = Math.min(2.5, Math.max(0.4, view.scale * factor))
  zoomViewAt(view, mx, my, next)
}

/** 双指捏合：按焦点缩放 + 跟随中心点平移（与旧实现同一公式） */
export function applyPinchZoom(
  view: IsoView,
  rect: { left: number; top: number },
  prevCenter: { x: number; y: number },
  center: { x: number; y: number },
  factor: number
): void {
  const nextScale = clampZoom(view.scale * factor, 0.4, 2.5)
  const mx = center.x - rect.left
  const my = center.y - rect.top
  const panDx = center.x - prevCenter.x
  const panDy = center.y - prevCenter.y
  view.panX = mx - ((mx - view.panX) / view.scale) * nextScale + panDx
  view.panY = my - ((my - view.panY) / view.scale) * nextScale + panDy
  view.scale = nextScale
}
