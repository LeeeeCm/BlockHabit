import type { BlockType } from '../types'

export interface IsoConfig {
  tileW: number
  tileH: number
  blockH: number
}

export interface IsoPalette {
  top: string
  left: string
  right: string
  ghost: string
  line: string
  accent: string
  /** 主题墨色（轮廓/交界线均按透明度派生自它） */
  ink: string
}

/** 世界坐标 → 屏幕坐标：(sx, sy) 为该立方体顶面菱形中心 */
export function worldToScreen(x: number, y: number, z: number, c: IsoConfig) {
  return {
    sx: (x - y) * (c.tileW / 2),
    sy: (x + y) * (c.tileH / 2) - z * c.blockH,
  }
}

/** 绕中心点 (cx, cy) 步进 90° 旋转坐标，rot 为象限序号 (0=0°, 1=90°, 2=180°, 3=270°) */
export function rotateCoord(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rot: number,
): { rx: number; ry: number } {
  const q = ((rot % 4) + 4) % 4
  const dx = x - cx
  const dy = y - cy
  switch (q) {
    case 1:
      return { rx: cx - dy, ry: cy + dx }
    case 2:
      return { rx: cx - dx, ry: cy - dy }
    case 3:
      return { rx: cx + dy, ry: cy - dx }
    default:
      return { rx: x, ry: y }
  }
}

/** 画家算法排序键：值小者先画（被后画者覆盖）。仅测试保留，实际排序见 BuildScene */
export const depth = (x: number, y: number, z: number): number => x + y + z

/** 块身高度：宽:深:高 = 1:1:1.2 投影换算；顶部凸点层另加高 STUD_H */
export const DEFAULT_ISO_CONFIG: IsoConfig = { tileW: 48, tileH: 24, blockH: 29 }
/** 凸点圆柱高度（真实乐高含凸点比例） */
export const STUD_H = 5

/* ---------------- 视图随窗口变化 ---------------- */

/** 画布视图：screen = iso 坐标 × scale + pan */
export interface IsoView {
  scale: number
  panX: number
  panY: number
}

/**
 * 窗口尺寸变化（最大化/还原/拖拽窗口边缘）后的视图跟随，用于用户已手动取景的场景：
 * 模型随窗口等比缩放（按宽高面积比的平方根，最大化再还原是精确逆变换），
 * 模型中心保持在窗口中的相对位置。
 * center 为模型包围盒中心（等距平面坐标），缩放钳制范围与滚轮缩放一致 [0.3, 3]。
 */
export function followResize(
  view: IsoView,
  prev: { w: number; h: number },
  next: { w: number; h: number },
  center: { x: number; y: number },
): IsoView {
  const relX = (view.panX + center.x * view.scale) / prev.w
  const relY = (view.panY + center.y * view.scale) / prev.h
  const scale = Math.min(
    3,
    Math.max(0.3, view.scale * Math.sqrt((next.w * next.h) / (prev.w * prev.h))),
  )
  return {
    scale,
    panX: relX * next.w - center.x * scale,
    panY: relY * next.h - center.y * scale,
  }
}

type Pt = [number, number]

/* ---------------- 颜色派生（从主题 CSS 变量程序化调整，双主题通用） ---------------- */

/** 解析 #rgb / #rrggbb / rgb(r,g,b) 为 [r,g,b] */
export function parseColor(color: string): [number, number, number] | null {
  const s = color.trim()
  if (s.startsWith('#')) {
    let hex = s.slice(1)
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
    if (hex.length !== 6) return null
    const n = parseInt(hex, 16)
    if (Number.isNaN(n)) return null
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  return null
}

/** 任意可解析颜色 + 透明度 → rgba() 字符串 */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
}

/** 亮度乘法调整（HSL 的 L 通道 ×mult，钳制在 [0,1]），返回 rgb() 字符串 */
export function adjustLightness(color: string, mult: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color
  const r = rgb[0] / 255
  const g = rgb[1] / 255
  const b = rgb[2] / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  const l2 = Math.min(1, Math.max(0, l * mult))
  // hsl → rgb
  if (s === 0) {
    const v = Math.round(l2 * 255)
    return `rgb(${v},${v},${v})`
  }
  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s
  const pp = 2 * l2 - q
  const hue = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return pp + (q - pp) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return pp + (q - pp) * (2 / 3 - tt) * 6
    return pp
  }
  return `rgb(${Math.round(hue(h + 1 / 3) * 255)},${Math.round(hue(h) * 255)},${Math.round(hue(h - 1 / 3) * 255)})`
}

/** 积木三面派生色：以 CSS 变量为最亮缘（100%），按光照比例向暗缘渐变 */
export interface BlockShading {
  topA: string
  topB: string
  leftA: string
  leftB: string
  rightA: string
  rightB: string
  studTop: string
}

const paletteShadingCache = new Map<string, BlockShading>()

export function deriveShading(p: IsoPalette): BlockShading {
  const key = `${p.top}_${p.left}_${p.right}`
  const cached = paletteShadingCache.get(key)
  if (cached) return cached
  const topA = adjustLightness(p.top, 1.0)
  const result: BlockShading = {
    topA,
    topB: adjustLightness(p.top, 0.9), // 顶面：后缘 100% → 前缘 90%
    leftA: adjustLightness(p.left, 1.0),
    leftB: adjustLightness(p.left, 50 / 65), // 左面：上 65% → 下 50%
    rightA: adjustLightness(p.right, 1.0),
    rightB: adjustLightness(p.right, 22 / 35), // 右面：上 35% → 下 22%
    studTop: adjustLightness(topA, 1.08), // 凸点顶比块顶亮 +8%
  }
  paletteShadingCache.set(key, result)
  return result
}

const shadingColorCache = new Map<string, BlockShading>()

/** 为任意自定义十六进制或 RGB 颜色派生符合等距立体光照的三面渐变色 */
export function deriveShadingForColor(baseColor: string): BlockShading {
  const cached = shadingColorCache.get(baseColor)
  if (cached) return cached
  const topA = adjustLightness(baseColor, 1.0)
  const result: BlockShading = {
    topA,
    topB: adjustLightness(baseColor, 0.88),
    leftA: adjustLightness(baseColor, 0.78),
    leftB: adjustLightness(baseColor, 0.62),
    rightA: adjustLightness(baseColor, 0.52),
    rightB: adjustLightness(baseColor, 0.36),
    studTop: adjustLightness(topA, 1.08),
  }
  shadingColorCache.set(baseColor, result)
  return result
}

/* ---------------- 几何工具 ---------------- */

/** 多边形圆角路径（标准无伪影 arcTo 连续收角）；r 为统一半径或逐顶点半径数组 */
export function roundedPoly(ctx: CanvasRenderingContext2D, pts: Pt[], r: number | number[]) {
  const n = pts.length
  if (n < 3) return
  const rAt = (i: number) => (typeof r === 'number' ? r : r[i] ?? r[0])

  // 从最后一条边 (n-1 -> 0) 的中点开始作为起始点，保证 arcTo 自动算切点且无尖角伪影
  const pLast = pts[n - 1]
  const pFirst = pts[0]
  const midX = (pLast[0] + pFirst[0]) / 2
  const midY = (pLast[1] + pFirst[1]) / 2

  ctx.beginPath()
  ctx.moveTo(midX, midY)

  for (let i = 0; i < n; i++) {
    const corner = pts[i]
    const next = pts[(i + 1) % n]
    const prev = pts[(i - 1 + n) % n]
    const l1 = Math.hypot(corner[0] - prev[0], corner[1] - prev[1])
    const l2 = Math.hypot(next[0] - corner[0], next[1] - corner[1])
    const maxR = Math.min(rAt(i), l1 / 2, l2 / 2)
    ctx.arcTo(corner[0], corner[1], next[0], next[1], maxR)
  }
  ctx.closePath()
}

export interface IsoCornerRadii {
  top: number
  side: number
  bottom: number
}

/**
 * 严格符合 3D 等距透视层级的水平圆角路径生成器：
 * - 底角 (Bottom)：面向视点最近，呈现最宽大的等距椭圆弧；
 * - 左右角 (Side)：对称中等弧度，完全镜像一致；
 * - 顶角 (Top)：远端消逝方向，呈现最小紧凑弧度。
 * 全曲线在 3D 轴系网格中生成后投影，具有天然 2:1 椭圆透视，绝无 2D 圆弧畸变与虚线折角瑕疵。
 */
export function traceIsoGroundPath(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  c: IsoConfig,
  radii: IsoCornerRadii,
  yOffset: number = 0,
) {
  const STEPS = 16
  const maxAllow = Math.min((x1 - x0) / 2.2, (y1 - y0) / 2.2)
  const rt = Math.max(0.01, Math.min(radii.top, maxAllow))
  const rs = Math.max(0.01, Math.min(radii.side, maxAllow))
  const rb = Math.max(0.01, Math.min(radii.bottom, maxAllow))

  ctx.beginPath()
  let first = true

  const pt = (gx: number, gy: number) => {
    const { sx, sy } = worldToScreen(gx, gy, 0, c)
    if (first) {
      ctx.moveTo(sx, sy + yOffset)
      first = false
    } else {
      ctx.lineTo(sx, sy + yOffset)
    }
  }

  // 1. 远端顶角 C0（弧形最小，由左向右转）
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    pt(x0 + rt - rt * Math.cos(a), y0 + rt - rt * Math.sin(a))
  }

  // 2. 右侧角 C1（左右对称中等弧度，由上向下转）
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    pt(x1 - rs + rs * Math.sin(a), y0 + rs - rs * Math.cos(a))
  }

  // 3. 近端底角 C2（最前方面向视点，弧形最大最平缓，由右向左转）
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    pt(x1 - rb + rb * Math.cos(a), y1 - rb + rb * Math.sin(a))
  }

  // 4. 左侧角 C3（与右侧完全对称相同弧度，由下向上转）
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * (Math.PI / 2)
    pt(x0 + rs - rs * Math.sin(a), y1 - rs + rs * Math.cos(a))
  }

  ctx.closePath()
}

export interface DrawCubeOptions {
  type?: BlockType
  /** 建筑模型自定义专属配色 */
  color?: string
  /** 连击奖励块：点缀色描边 */
  bonus?: boolean
  /** 虚影绘制（不再用于建造页，保留给预览等场景） */
  ghost?: boolean
  /** 高亮描边 */
  highlight?: boolean
  /** 不画乐高凸点（顶上有方块时省略） */
  noStuds?: boolean
  /** 铭文印记（附带随笔） */
  hasNote?: boolean
  /** 星标铭文高光 */
  starred?: boolean
}

/** 圆柱凸点：侧裙（左半/右半分侧向光）→ 顶面 → 左上高光弧 */
function drawStud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  h: number,
  sh: BlockShading,
  ink: string,
) {
  const skirt = () => {
    ctx.beginPath()
    ctx.moveTo(cx - rx, cy - h)
    ctx.lineTo(cx - rx, cy)
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true)
    ctx.lineTo(cx + rx, cy - h)
    ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI, true)
    ctx.closePath()
  }
  // 侧裙：左半 = 左面亮度，右半 = 右面亮度
  skirt()
  ctx.fillStyle = sh.leftA
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.rect(cx, cy - h - ry - 1, rx + 2, h + ry * 2 + 2)
  ctx.clip()
  skirt()
  ctx.fillStyle = sh.rightA
  ctx.fill()
  ctx.restore()
  skirt()
  ctx.strokeStyle = withAlpha(ink, 0.4)
  ctx.lineWidth = 1
  ctx.stroke()
  // 顶面（比块顶亮 +8%）
  ctx.beginPath()
  ctx.ellipse(cx, cy - h, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = sh.studTop
  ctx.fill()
  ctx.stroke()
  // 顶面左上高光弧（白 60%）
  ctx.beginPath()
  ctx.ellipse(cx, cy - h, rx * 0.68, ry * 0.68, 0, Math.PI * 1.05, Math.PI * 1.6)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1.2
  ctx.stroke()
}
type SpriteCanvas = HTMLCanvasElement | OffscreenCanvas

export interface CubeSprite {
  canvas: SpriteCanvas
  anchorX: number
  anchorY: number
  width: number
  height: number
}

const spriteCache = new Map<string, CubeSprite>()
const MAX_SPRITE_CACHE = 512

export function clearCubeSpriteCache(): void {
  spriteCache.clear()
}

export function getCubeSprite(
  color: string | undefined,
  type: BlockType,
  noStuds: boolean,
  c: IsoConfig,
  p: IsoPalette,
  dpr: number,
): CubeSprite | null {
  const colorPart = color ? color : `${p.top}_${p.left}_${p.right}`
  const cacheKey = `${colorPart}_${type}_${noStuds}_${c.tileW}_${c.tileH}_${c.blockH}_${dpr}_${p.ink}_${p.accent}`
  let sprite = spriteCache.get(cacheKey)
  if (sprite) return sprite

  const pad = 4
  const w = c.tileW / 2
  const h = c.tileH / 2
  const cssW = Math.ceil(c.tileW + pad * 2)
  const cssH = Math.ceil(c.tileH + c.blockH + STUD_H + pad * 2)
  const pixW = Math.round(cssW * dpr)
  const pixH = Math.round(cssH * dpr)

  let canvas: SpriteCanvas
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(pixW, pixH)
  } else if (typeof document !== 'undefined' && document.createElement) {
    const el = document.createElement('canvas')
    el.width = pixW
    el.height = pixH
    canvas = el
  } else {
    return null
  }

  const sCtx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!sCtx) return null

  sCtx.scale(dpr, dpr)
  const anchorX = w + pad
  const anchorY = h + STUD_H + pad

  drawCubeBody(sCtx as unknown as CanvasRenderingContext2D, anchorX, anchorY, c, p, color, type, noStuds)

  sprite = { canvas, anchorX, anchorY, width: cssW, height: cssH }
  if (spriteCache.size >= MAX_SPRITE_CACHE) {
    const firstKey = spriteCache.keys().next().value
    if (firstKey) spriteCache.delete(firstKey)
  }
  spriteCache.set(cacheKey, sprite)
  return sprite
}

function drawCubeBody(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  c: IsoConfig,
  p: IsoPalette,
  color: string | undefined,
  type: BlockType,
  noStuds: boolean,
): void {
  const w = c.tileW / 2
  const h = c.tileH / 2
  const bh = c.blockH

  const T: Pt = [sx, sy - h]
  const R: Pt = [sx + w, sy]
  const BR: Pt = [sx + w, sy + bh]
  const B: Pt = [sx, sy + h + bh]
  const BL: Pt = [sx - w, sy + bh]
  const L: Pt = [sx - w, sy]
  const F: Pt = [sx, sy + h]

  const sil: Pt[] = [T, R, BR, B, BL, L]
  const top: Pt[] = [T, R, F, L]
  const left: Pt[] = [L, F, B, BL]
  const right: Pt[] = [F, R, BR, B]

  const cornerR = Math.min(3, c.tileW * 0.0625)
  const silR = [0, cornerR, cornerR, 0, cornerR, cornerR]

  const sh = color ? deriveShadingForColor(color) : deriveShading(p)
  const polyPath = (pts: Pt[]) => {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.closePath()
  }

  ctx.save()
  roundedPoly(ctx, sil, silR)
  ctx.clip()

  const gTop = ctx.createLinearGradient(sx, sy - h, sx, sy + h)
  gTop.addColorStop(0, sh.topA)
  gTop.addColorStop(1, sh.topB)

  const gLeft = ctx.createLinearGradient(sx, sy, sx, sy + bh)
  gLeft.addColorStop(0, sh.leftA)
  gLeft.addColorStop(1, sh.leftB)

  const gRight = ctx.createLinearGradient(sx, sy, sx, sy + bh)
  gRight.addColorStop(0, sh.rightA)
  gRight.addColorStop(1, sh.rightB)

  polyPath(left)
  ctx.fillStyle = gLeft
  ctx.fill()
  polyPath(right)
  ctx.fillStyle = gRight
  ctx.fill()

  const gAo = ctx.createLinearGradient(sx, sy + bh * 0.45, sx, sy + h + bh)
  gAo.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gAo.addColorStop(1, withAlpha(p.ink, 0.15))
  ctx.fillStyle = gAo
  polyPath(left)
  ctx.fill()
  polyPath(right)
  ctx.fill()

  polyPath(top)
  ctx.fillStyle = gTop
  ctx.fill()

  const gTopSpec = ctx.createLinearGradient(sx - w, sy - h, sx + w, sy + h)
  gTopSpec.addColorStop(0, 'rgba(255, 255, 255, 0.14)')
  gTopSpec.addColorStop(0.65, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gTopSpec
  polyPath(top)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(L[0], L[1])
  ctx.lineTo(F[0], F[1])
  ctx.lineTo(R[0], R[1])
  ctx.moveTo(F[0], F[1])
  ctx.lineTo(B[0], B[1])
  ctx.strokeStyle = withAlpha(p.ink, 0.4)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  roundedPoly(ctx, sil, silR)
  ctx.strokeStyle = withAlpha(p.ink, 0.58)
  ctx.lineWidth = 1.5
  ctx.stroke()

  if (!noStuds) {
    drawStud(ctx, sx, sy, c.tileW * 0.25, c.tileW * 0.25 * (c.tileH / c.tileW), STUD_H, sh, p.ink)
  }
  decorate(ctx, sx, sy, c, p, type)
}

export function drawCube(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  c: IsoConfig,
  p: IsoPalette,
  opts: DrawCubeOptions = {},
) {
  const w = c.tileW / 2
  const h = c.tileH / 2
  const bh = c.blockH
  const {
    type = 'basic',
    bonus = false,
    ghost = false,
    highlight = false,
    noStuds = false,
    hasNote = false,
    starred = false,
  } = opts

  // 顶点：T 后 / R 右 / B 前下 / L 左 / F 顶面前角（三面交点）
  const T: Pt = [sx, sy - h]
  const R: Pt = [sx + w, sy]
  const BR: Pt = [sx + w, sy + bh]
  const B: Pt = [sx, sy + h + bh]
  const BL: Pt = [sx - w, sy + bh]
  const L: Pt = [sx - w, sy]
  const F: Pt = [sx, sy + h]

  const sil: Pt[] = [T, R, BR, B, BL, L]
  const top: Pt[] = [T, R, F, L]

  // 外剪影四角圆润倒角 ≈3px（T/B 保持尖角），三面共享精确边，不倒角出透缝
  const cornerR = Math.min(3, c.tileW * 0.0625)
  const silR = [0, cornerR, cornerR, 0, cornerR, cornerR]

  ctx.save()
  ctx.globalAlpha = ghost ? 0.15 : 1

  if (ghost) {
    roundedPoly(ctx, sil, silR)
    ctx.fillStyle = p.ghost
    ctx.fill()
    ctx.strokeStyle = p.ghost
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
    return
  }

  const polyPath = (pts: Pt[]) => {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.closePath()
  }

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
  const sprite = getCubeSprite(opts.color, type, noStuds, c, p, dpr)
  if (sprite) {
    ctx.drawImage(
      sprite.canvas as CanvasImageSource,
      sx - sprite.anchorX,
      sy - sprite.anchorY,
      sprite.width,
      sprite.height,
    )
  } else {
    drawCubeBody(ctx, sx, sy, c, p, opts.color, type, noStuds)
  }
  if (hasNote) {
    ctx.save()
    ctx.beginPath()
    const lx = L[0] + (F[0] - L[0]) * 0.35
    const ly = L[1] + (F[1] - L[1]) * 0.35 + bh * 0.25
    ctx.moveTo(lx, ly)
    ctx.lineTo(lx, ly + bh * 0.45)
    ctx.strokeStyle = withAlpha(p.ink, 0.28)
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.restore()
  }

  if (starred) {
    ctx.save()
    polyPath(top)
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1.6
    ctx.stroke()
    if (!noStuds) {
      ctx.beginPath()
      const rx = c.tileW * 0.12
      const ry = rx * (c.tileH / c.tileW)
      ctx.ellipse(sx, sy - STUD_H, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#f59e0b'
      ctx.fill()
    }
    ctx.restore()
  }

  if (highlight) {
    ctx.save()
    roundedPoly(ctx, sil, silR)
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 2.4
    ctx.stroke()
    ctx.restore()
  } else if (bonus) {
    polyPath(top)
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.restore()
}

/** 射线法点在多边形内判定（用于等距 3D 积木鼠标拾取） */
export function pointInPoly(x: number, y: number, vs: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0]
    const yi = vs[i][1]
    const xj = vs[j][0]
    const yj = vs[j][1]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** 判定屏幕坐标 (px, py) 是否落在位于 (sx, sy) 的 2.5D 等距积木六边形投影及凸点区域内 */
export function isPointInsideCube(
  px: number,
  py: number,
  sx: number,
  sy: number,
  c: IsoConfig = DEFAULT_ISO_CONFIG,
): boolean {
  const w = c.tileW / 2
  const h = c.tileH / 2
  const bh = c.blockH
  const poly: Array<[number, number]> = [
    [sx, sy - h],
    [sx + w, sy],
    [sx + w, sy + bh],
    [sx, sy + h + bh],
    [sx - w, sy + bh],
    [sx - w, sy],
  ]
  return pointInPoly(px, py, poly)
}

function decorate(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  c: IsoConfig,
  p: IsoPalette,
  type: BlockType,
) {
  const w = c.tileW / 2
  const h = c.tileH / 2
  const bh = c.blockH
  switch (type) {
    case 'window': {
      // 左面窗：点缀色
      ctx.fillStyle = p.accent
      roundedPoly(
        ctx,
        [
          [sx - w * 0.45, sy + h * 0.35 + bh * 0.2],
          [sx - w * 0.15, sy + h * 0.65 + bh * 0.2],
          [sx - w * 0.15, sy + h * 0.65 + bh * 0.55],
          [sx - w * 0.45, sy + h * 0.35 + bh * 0.55],
        ],
        1.5,
      )
      ctx.fill()
      break
    }
    case 'gate': {
      // 右面门：墨色（主题感知）
      ctx.fillStyle = withAlpha(p.ink, 0.55)
      roundedPoly(
        ctx,
        [
          [sx + w * 0.15, sy + h * 0.5 + bh * 0.15],
          [sx + w * 0.5, sy + h * 0.85 + bh * 0.15],
          [sx + w * 0.5, sy + h * 0.85 + bh * 0.85],
          [sx + w * 0.15, sy + h * 0.5 + bh * 0.85],
        ],
        1.5,
      )
      ctx.fill()
      break
    }
    default:
      break
  }
}

/** 建造范围框：模型在底层地面上的等距投影——躺在地面平面（z=0 块底面平面）上的圆角菱形 */
export function drawGroundBounds(
  ctx: CanvasRenderingContext2D,
  blocks: Array<{ x: number; y: number }>,
  c: IsoConfig,
  p: IsoPalette,
  rot: number = 0,
  cx: number = 0,
  cy: number = 0,
  enableEcoProps = false,
) {
  // 全部楼层块的 x/y 包围盒（块坐标为格中心，外扩半格即水平占地范围；
  // 凸点水平投影位于格中心、半径小于半格宽，天然被包含）
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const b of blocks) {
    const { rx, ry } = rotateCoord(b.x, b.y, cx, cy, rot)
    minX = Math.min(minX, rx)
    maxX = Math.max(maxX, rx)
    minY = Math.min(minY, ry)
    maxY = Math.max(maxY, ry)
  }
  const margin = 0.55
  const x0 = minX - 0.5 - margin
  const x1 = maxX + 0.5 + margin
  const y0 = minY - 0.5 - margin
  const y1 = maxY + 0.5 + margin

  // 视角透视圆角阶梯：底角平缓舒展 (0.95) > 左右对称适中 (0.70) > 远端顶角紧凑自然 (0.50)
  const radii: IsoCornerRadii = {
    bottom: 0.95,
    side: 0.70,
    top: 0.50,
  }

  ctx.save()
  traceIsoGroundPath(ctx, x0, x1, y0, y1, c, radii, c.blockH)
  ctx.fillStyle = 'rgba(128, 128, 128, 0.05)'
  ctx.fill()
  ctx.setLineDash([8, 6])
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = p.ghost
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore()

  // 连胜微生态彩蛋：在底座边缘自然生长微缩鹅卵石与小草芽
  if (enableEcoProps && blocks.length >= 2) {
    ctx.save()
    // 1. 微型鹅卵石点缀 (Pebbles)
    const p1 = worldToScreen(x0 + 0.35, y1 - 0.45, 0, c)
    const p2 = worldToScreen(x0 + 0.65, y1 - 0.3, 0, c)
    ctx.fillStyle = p.left
    ctx.beginPath()
    ctx.ellipse(p1.sx, p1.sy, 3.2, 1.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(p2.sx, p2.sy, 2.4, 1.4, 0, 0, Math.PI * 2)
    ctx.fill()

    // 2. 微型小萌芽 (Flora Sprout)
    const sp = worldToScreen(x1 - 0.4, y0 + 0.4, 0, c)
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.ellipse(sp.sx - 2, sp.sy - 1, 2.5, 1.3, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(sp.sx + 2, sp.sy - 1, 2.5, 1.3, 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
export type TimePeriod = 'dawn' | 'noon' | 'dusk' | 'night'

/** 获取当前时段（晨曦/正午/黄昏/夜幕） */
export function getTimePeriod(hour = new Date().getHours()): TimePeriod {
  if (hour >= 6 && hour < 10) return 'dawn'
  if (hour >= 10 && hour < 16) return 'noon'
  if (hour >= 16 && hour < 19) return 'dusk'
  return 'night'
}

function applyAmbientLighting(p: IsoPalette, period: TimePeriod): IsoPalette {
  switch (period) {
    case 'dawn':
      // 晨曦：微暖金光，顶面与受光面泛起柔和晨光
      return {
        ...p,
        top: adjustLightness(p.top, 1.04),
        left: adjustLightness(p.left, 1.02),
        right: adjustLightness(p.right, 0.96),
      }
    case 'dusk':
      // 黄昏：日落暖橘光影，暗面加深，顶面微金
      return {
        ...p,
        top: adjustLightness(p.top, 1.03),
        left: adjustLightness(p.left, 0.95),
        right: adjustLightness(p.right, 0.90),
      }
    case 'night':
      // 夜幕：微缩夜灯质感，顶面保留台灯聚光，侧暗面更沉稳
      return {
        ...p,
        top: adjustLightness(p.top, 0.98),
        left: adjustLightness(p.left, 0.88),
        right: adjustLightness(p.right, 0.82),
        ghost: adjustLightness(p.ghost, 0.9),
      }
    case 'noon':
    default:
      // 正午：标准高对比度自然光
      return p
  }
}

let cachedThemeKey = ''
let cachedPalette: IsoPalette | null = null

/** 从 CSS 变量读取当前主题的调色板（支持时段感知昼夜环境光照与记忆化缓存） */
export function paletteFromDocument(doc: Document = document, enableAmbient = false): IsoPalette {
  const theme = doc.documentElement.getAttribute('data-theme') || 'light'
  const period: TimePeriod = enableAmbient ? getTimePeriod() : 'noon'
  const cacheKey = `${theme}_${enableAmbient ? period : 'std'}`
  if (cachedPalette && cachedThemeKey === cacheKey) {
    return cachedPalette
  }
  const s = getComputedStyle(doc.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  const basePalette: IsoPalette = {
    top: v('--block-top'),
    left: v('--block-left'),
    right: v('--block-right'),
    ghost: v('--block-ghost'),
    line: v('--line'),
    accent: v('--accent'),
    ink: v('--ink'),
  }
  cachedThemeKey = cacheKey
  cachedPalette = enableAmbient ? applyAmbientLighting(basePalette, period) : basePalette
  return cachedPalette
}
