/**
 * 2.5D 积木的绘制与精灵缓存（E4 拆分自 iso.ts）：
 * 单块绘制（顶/左/右三面 + 圆角 + 凸点 + 装饰）、离屏精灵缓存（LRU + 字节预算）、命中检测。
 */
import type { BlockType } from '../types'
import {
  deriveShading,
  deriveShadingForColor,
  withAlpha,
  type BlockShading,
  type IsoPalette
} from './isoColor'
import { DEFAULT_ISO_CONFIG, STUD_H, roundedPoly, type IsoConfig, type Pt } from './isoGeometry'

export interface DrawCubeOptions {
  type?: BlockType
  /** 建筑模型自定义专属配色 */
  color?: string
  /** 奖励块标记（B5）：streak = 连击里程碑（单环），attendance = 全勤大满贯（双环，视觉更重一级） */
  bonusTier?: 'streak' | 'attendance'
  /** 兼容旧调用：等价于 bonusTier = 'streak' */
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
  /** 精灵位图密度覆盖：导出画布等固定 2x 变换的上下文传 2（缺省取 devicePixelRatio） */
  spriteScale?: number
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
  ink: string
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
/** 条目数上限（LRU 淘汰） */
const MAX_SPRITE_CACHE = 512
/**
 * 位图总预算（字节）。条目数上限不足以约束内存：单个精灵大小随 dpr 平方增长
 * （dpr=2 约 15KB，dpr=4 约 245KB），512 条在高 DPR 下会到 30MB+。
 * 这里再按字节兜一层，保证弱机/高分屏上不会因精灵缓存把内存打爆。
 */
const MAX_SPRITE_BYTES = 24 * 1024 * 1024
let spriteCacheBytes = 0

function spriteBytesOf(s: CubeSprite): number {
  const w = (s.canvas as { width: number }).width
  const h = (s.canvas as { height: number }).height
  return w * h * 4
}

export function clearCubeSpriteCache(): void {
  spriteCache.clear()
  spriteCacheBytes = 0
}

/** 诊断/测试用：当前精灵缓存规模 */
export function cubeSpriteCacheStats(): { count: number; bytes: number } {
  return { count: spriteCache.size, bytes: spriteCacheBytes }
}

export function getCubeSprite(
  color: string | undefined,
  type: BlockType,
  noStuds: boolean,
  c: IsoConfig,
  p: IsoPalette,
  dpr: number
): CubeSprite | null {
  const colorPart = color ? color : `${p.top}_${p.left}_${p.right}`
  const cacheKey = `${colorPart}_${type}_${noStuds}_${c.tileW}_${c.tileH}_${c.blockH}_${dpr}_${p.ink}_${p.accent}_${p.top}_${p.left}_${p.right}`
  let sprite = spriteCache.get(cacheKey)
  if (sprite) {
    // LRU：命中即移到队尾（Map 的插入序），避免「刚用过的块」被后面的新块挤掉
    spriteCache.delete(cacheKey)
    spriteCache.set(cacheKey, sprite)
    return sprite
  }

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

  const sCtx = canvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!sCtx) return null

  sCtx.scale(dpr, dpr)
  const anchorX = w + pad
  const anchorY = h + STUD_H + pad

  drawCubeBody(
    sCtx as unknown as CanvasRenderingContext2D,
    anchorX,
    anchorY,
    c,
    p,
    color,
    type,
    noStuds
  )

  sprite = { canvas, anchorX, anchorY, width: cssW, height: cssH }
  const incoming = spriteBytesOf(sprite)
  // 淘汰最久未使用（Map 头部）：同时守住条目数与字节预算两条上限
  while (
    spriteCache.size > 0 &&
    (spriteCache.size >= MAX_SPRITE_CACHE || spriteCacheBytes + incoming > MAX_SPRITE_BYTES)
  ) {
    const oldestKey = spriteCache.keys().next().value
    if (!oldestKey) break
    const evicted = spriteCache.get(oldestKey)
    if (evicted) spriteCacheBytes -= spriteBytesOf(evicted)
    spriteCache.delete(oldestKey)
  }
  spriteCache.set(cacheKey, sprite)
  spriteCacheBytes += incoming
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
  noStuds: boolean
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
  opts: DrawCubeOptions = {}
) {
  const w = c.tileW / 2
  const h = c.tileH / 2
  const bh = c.blockH
  const {
    type = 'basic',
    bonus = false,
    bonusTier,
    ghost = false,
    highlight = false,
    noStuds = false,
    hasNote = false,
    starred = false
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

  // 精灵密度跟随 ctx 真实变换尺度（dpr × view.scale，量化 0.25 步长防缓存抖动）：
  // view.scale > 1 时按更高密度重烘焙，避免放大模糊
  const t = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null
  const transformScale =
    t && typeof t.a === 'number' && t.a > 0
      ? t.a
      : typeof window !== 'undefined'
        ? Math.min(window.devicePixelRatio || 1, 2)
        : 1
  const dpr = opts.spriteScale ?? Math.max(1, Math.min(4, Math.round(transformScale * 4) / 4))
  const sprite = getCubeSprite(opts.color, type, noStuds, c, p, dpr)
  if (sprite) {
    ctx.drawImage(
      sprite.canvas as CanvasImageSource,
      sx - sprite.anchorX,
      sy - sprite.anchorY,
      sprite.width,
      sprite.height
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
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 1.6
    ctx.stroke()
    if (!noStuds) {
      ctx.beginPath()
      const rx = c.tileW * 0.12
      const ry = rx * (c.tileH / c.tileW)
      ctx.ellipse(sx, sy - STUD_H, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = p.accent
      ctx.fill()
    }
    ctx.restore()
  }

  if (highlight) {
    ctx.save()
    roundedPoly(ctx, sil, silR)
    ctx.strokeStyle = p.accent
    ctx.lineWidth = 2.4
    ctx.stroke()
    ctx.restore()
  } else if (bonusTier || bonus) {
    // B5：奖励块分两个视觉等级，但**只用同一枚点缀色**——靠「环的层数/粗细」分级
    const tier = bonusTier ?? 'streak'
    polyPath(top)
    ctx.strokeStyle = p.accent
    ctx.lineWidth = tier === 'attendance' ? 2.4 : 1.5
    ctx.stroke()
    if (tier === 'attendance') {
      // 内缩 22% 的第二道细环：同色相、更细，读作「证书双框」
      const inner: Pt[] = top.map(([x, y]) => [sx + (x - sx) * 0.78, sy + (y - sy) * 0.78]) as Pt[]
      polyPath(inner)
      ctx.lineWidth = 1.1
      ctx.stroke()
    }
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
  c: IsoConfig = DEFAULT_ISO_CONFIG
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
    [sx - w, sy]
  ]
  return pointInPoly(px, py, poly)
}

function decorate(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  c: IsoConfig,
  p: IsoPalette,
  type: BlockType
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
          [sx - w * 0.45, sy + h * 0.35 + bh * 0.55]
        ],
        1.5
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
          [sx + w * 0.15, sy + h * 0.5 + bh * 0.85]
        ],
        1.5
      )
      ctx.fill()
      break
    }
    default:
      break
  }
}
