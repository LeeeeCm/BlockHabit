/**
 * 场景取景（E5 拆分自 BuildScene.tsx）：把包围盒拟合成「画布尺度 + 平移」。
 *
 * 两条上限都保留了 D10 的取舍：
 * - 单轴最多 2 倍，避免整座蓝图被放到离谱大小；
 * - 开荒期最多「整蓝图刚好铺满」的 1.5 倍，再大就会把地基虚线裁出画面。
 */
export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** 取景留白（CSS 像素） */
export const FIT_PAD = 48
/** 单轴最大缩放 */
export const MAX_FIT_SCALE = 2
/** 开荒期允许的最大放大倍数（相对「整蓝图刚好铺满」） */
export const EARLY_ZOOM_CAP = 1.5
/** 模型中心在视口中的垂直位置（偏下，给顶部工具条留空间） */
export const VERTICAL_CENTER_RATIO = 0.56

export interface FitView {
  scale: number
  panX: number
  panY: number
}

export function computeFitView(args: {
  /** 实际取景盒（开荒期只框住已放置积木） */
  bounds: Bounds
  /** 整座蓝图的包围盒（用于限制开荒期放大倍数） */
  allBounds: Bounds
  width: number
  height: number
  pad?: number
}): FitView {
  const { bounds, allBounds, width, height, pad = FIT_PAD } = args
  const fitScaleOf = (b: Bounds) =>
    Math.min(
      (width - pad * 2) / (b.maxX - b.minX),
      (height - pad * 2) / (b.maxY - b.minY),
      MAX_FIT_SCALE
    )
  const scale = Math.min(
    fitScaleOf(bounds),
    Math.min(MAX_FIT_SCALE, fitScaleOf(allBounds) * EARLY_ZOOM_CAP)
  )
  return {
    scale,
    panX: width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    panY: height * VERTICAL_CENTER_RATIO - ((bounds.minY + bounds.maxY) / 2) * scale
  }
}
