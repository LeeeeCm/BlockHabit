import {
  contrastRatio,
  deriveShading,
  parseColor,
  withAlpha,
  type BlockShading,
  type IsoPalette
} from './isoColor'
import { DEFAULT_ISO_CONFIG, STUD_H, roundedPoly, type Pt } from './isoGeometry'
import { drawGroundShadow } from './isoGround'
import { projectPet, type PetPart } from './petGeometry'
import { PEAK_HOP_LIFT, type PetPose } from './petMotion'

export type PetMood = 'idle' | 'focus' | 'ready' | 'happy'

interface PetFrame {
  width: number
  height: number
  mood: PetMood
  palette: IsoPalette
  pose: Readonly<PetPose>
  blinking: boolean
  /** 自定义材质色派生的三面明暗；缺省跟随主题 */
  shading?: BlockShading
}

type FacetShades = [string, string]

interface PetLighting {
  brick: BlockShading
  front: FacetShades
  side: FacetShades
  faceInk: string
}

const { tileW, tileH, blockH } = DEFAULT_ISO_CONFIG
const MAX_STAGE_SCALE = 3
/** 桌宠正脸为主：手写几何的转身幅度上限（等距建筑是 ±45 度，桌宠只需轻微侧倾） */
export const FRONT_TURN_LIMIT = 0.265
const CORNER_RADIUS = Math.min(3, tileW * 0.0625)
const PAD = 2
const TURNED_BODY_HEIGHT = blockH + tileH + STUD_H
/** 窗口底部留给接触阴影的像素；脚底锚点贴底，不再像旧窗口那样垂直居中。 */
const BOTTOM_ROOM = 10
/** 三档尺寸共用同一窗口：按最大档 1.05 倍预留，避免切到大号时裁切。 */
const MAX_SIZE_SCALE = 1.05
/** 侧向转体时立方体的最大横向占位；单块积木不超过 tileW。 */
const ART_MAX_WIDTH = tileW
/** 脚底到跳跃最高点（含凸点）的最大占位。 */
const ART_MAX_HEIGHT = TURNED_BODY_HEIGHT + PEAK_HOP_LIFT
const SHADOW_CONFIG = { tileW: tileW * 0.6, tileH: tileH * 0.45, blockH: 0 }
const SHADOW_FOOTPRINT = [{ x: 0, y: 0 }]

function mixShade(from: string, to: string, amount: number): string {
  if (amount === 0) return from
  if (amount === 1) return to
  const start = parseColor(from)
  const end = parseColor(to)
  if (!start || !end) return from
  return `rgb(${start.map((channel, i) => Math.round(channel + (end[i] - channel) * amount)).join(',')})`
}

function petLighting(palette: IsoPalette, turn: number, customShading?: BlockShading): PetLighting {
  const brick = customShading ?? deriveShading(palette)
  // 右跳时正脸逐渐变成右侧暗面；只在原有两面材质之间插值，避免起跳闪色。
  const mix = Math.max(0, turn)
  const front: FacetShades = [
    mixShade(brick.leftA, brick.rightA, mix),
    mixShade(brick.leftB, brick.rightB, mix)
  ]
  const faceTone = mixShade(brick.leftA, brick.leftB, 0.5)
  // 脸墨色按静止正面决定，跳转过程中不随侧面明暗重新选色，避免黑白翻转。
  const faceInk =
    contrastRatio(palette.ink, faceTone) >= contrastRatio(brick.topA, faceTone)
      ? palette.ink
      : brick.topA
  return {
    brick,
    front,
    faceInk,
    side: turn > 0 ? [brick.leftA, brick.leftB] : [brick.rightA, brick.rightB]
  }
}

function fillFacet(ctx: CanvasRenderingContext2D, points: Pt[], a: string, b: string) {
  const ys = points.map(([, y]) => y)
  const gradient = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys))
  gradient.addColorStop(0, a)
  gradient.addColorStop(1, b)
  roundedPoly(ctx, points, 0)
  ctx.fillStyle = gradient
  ctx.fill()
}

/** isoCube 凸点的同一圆柱侧裙、顶面和左上高光，纵轴随相机浅俯视。 */
function paintStud(
  ctx: CanvasRenderingContext2D,
  stud: NonNullable<PetPart['stud']>,
  sh: BlockShading,
  ink: string
) {
  const {
    center: [x, y],
    rx,
    ry,
    height
  } = stud
  const skirt = () => {
    ctx.beginPath()
    ctx.moveTo(x - rx, y - height)
    ctx.lineTo(x - rx, y)
    ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0, true)
    ctx.lineTo(x + rx, y - height)
    ctx.ellipse(x, y - height, rx, ry, 0, 0, Math.PI, true)
    ctx.closePath()
  }
  ctx.save()
  skirt()
  ctx.fillStyle = sh.leftA
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y - height - ry, rx, height + 2 * ry)
  ctx.clip()
  skirt()
  ctx.fillStyle = sh.rightA
  ctx.fill()
  ctx.restore()
  skirt()
  ctx.strokeStyle = withAlpha(ink, 0.4)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(x, y - height, rx, ry, 0, 0, 2 * Math.PI)
  ctx.fillStyle = sh.studTop
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(x, y - height, 0.68 * rx, 0.68 * ry, 0, 1.05 * Math.PI, 1.6 * Math.PI)
  ctx.strokeStyle = 'white' // ART §3 的原凸点高光，不是调色板新颜色
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()
}

function paintEyes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mood: PetMood,
  blinking: boolean
) {
  const y = height * 0.4
  const radius = Math.min(width, height) * 0.07
  const eyesAsLines = blinking || mood === 'focus' || mood === 'happy'
  ctx.beginPath()
  for (const x of [width * 0.32, width * 0.68]) {
    const rx = mood === 'ready' ? radius * 1.18 : radius
    if (eyesAsLines) {
      ctx.moveTo(x - rx, y)
      if (mood === 'happy') ctx.quadraticCurveTo(x, y - rx * 1.7, x + rx, y)
      else ctx.lineTo(x + rx, y)
    } else {
      const ry = radius * 2
      // 竖向胶囊：上下端半圆、左右直边，不再是圆点或椭圆
      ctx.roundRect(x - rx, y - ry, rx * 2, ry * 2, rx)
    }
  }
  if (eyesAsLines) ctx.stroke()
  else ctx.fill()
}

function paintFace(
  ctx: CanvasRenderingContext2D,
  part: PetPart,
  mood: PetMood,
  blinking: boolean,
  ink: string
) {
  if (!part.face) return
  const { width, height } = part.face
  const [left, right] = part.front
  ctx.save()
  // 正面自己的局部坐标：两眼和嘴共用这一变换，不换面也不镜像。
  ctx.transform((right[0] - left[0]) / width, (right[1] - left[1]) / width, 0, 1, ...left)
  ctx.strokeStyle = ink
  ctx.fillStyle = ink
  ctx.lineCap = 'round'
  ctx.lineWidth = 1.5
  paintEyes(ctx, width, height, mood, blinking)

  const x = width / 2
  const y = height * 0.68
  const radius = Math.min(width, height) * 0.12
  ctx.beginPath()
  if (mood === 'ready') {
    ctx.ellipse(x, y, radius * 0.62, radius * 0.68, 0, 0, 2 * Math.PI)
  } else {
    ctx.moveTo(x - radius, y)
    const curve = mood === 'happy' ? radius : mood === 'idle' ? radius * 0.44 : 0
    ctx.quadraticCurveTo(x, y + curve, x + radius, y)
  }
  ctx.stroke()
  ctx.restore()
}

function paintPart(
  ctx: CanvasRenderingContext2D,
  part: PetPart,
  lighting: PetLighting,
  frame: PetFrame
) {
  const { ink } = frame.palette
  const { brick: sh, front, side, faceInk } = lighting
  ctx.save()
  roundedPoly(ctx, part.outline, CORNER_RADIUS)
  ctx.clip()
  // 同色底避免多面共享棱线在 HiDPI 抗锯齿时露缝。
  ctx.fillStyle = front[0]
  ctx.fill()
  fillFacet(ctx, part.front, ...front)
  for (const facet of part.facets) {
    if (facet.kind === 'top') fillFacet(ctx, facet.points, sh.topA, sh.topB)
    else fillFacet(ctx, facet.points, ...side)
  }
  ctx.beginPath()
  for (const {
    seam: [a, b]
  } of part.facets) {
    ctx.moveTo(...a)
    ctx.lineTo(...b)
  }
  ctx.strokeStyle = withAlpha(ink, 0.4)
  ctx.lineWidth = 1
  ctx.stroke()
  paintFace(ctx, part, frame.mood, frame.blinking, faceInk)
  ctx.restore()

  roundedPoly(ctx, part.outline, CORNER_RADIUS)
  ctx.strokeStyle = withAlpha(ink, 0.58)
  ctx.lineWidth = 1.5
  ctx.stroke()
  if (part.stud) paintStud(ctx, part.stud, sh, ink)
}

/** 小窗只为短跳预留最少上升空间；宽松画布保留完整幅度，整段不重取景。 */
/** 桌宠脚底/接地线的屏幕 y；缩放角色时以它为锚点，底部位置不变。 */
export function petStageFloor(_width: number, height: number): number {
  return Math.max(PAD + 1, height - BOTTOM_ROOM)
}

/** 角色在窗口内的绘制比例：宽、高都按最大档预留，跳起与侧身都不越界。 */
export interface PetLayout {
  /** 脚底/接地线的屏幕 y */
  floor: number
  /** 角色绘制比例（未乘用户选择的小/中/大档位） */
  scale: number
  /** 角色最大横向占位（等距单位） */
  artWidth: number
  /** 脚底到跳跃最高点的最大占位（等距单位） */
  artHeight: number
}

export function petLayout(width: number, height: number): PetLayout {
  const floor = petStageFloor(width, height)
  const scale = Math.min(
    MAX_STAGE_SCALE,
    (width - PAD * 2) / (ART_MAX_WIDTH * MAX_SIZE_SCALE),
    Math.max(0, floor - PAD) / (ART_MAX_HEIGHT * MAX_SIZE_SCALE)
  )
  return { floor, scale, artWidth: ART_MAX_WIDTH, artHeight: ART_MAX_HEIGHT }
}

export function paintPet(ctx: CanvasRenderingContext2D, frame: PetFrame): void {
  const { width, height, pose, palette } = frame
  const { floor, scale } = petLayout(width, height)
  if (scale <= 0) return
  const liftRoom = Math.min(PEAK_HOP_LIFT, (floor - PAD) / scale - TURNED_BODY_HEIGHT)
  // 正脸为主（D-20261127-123）：转身幅度收敛到 FRONT_TURN_LIMIT，不做左右各 45 度的甩头
  const turn = Math.max(-1, Math.min(1, pose.turn)) * FRONT_TURN_LIMIT
  const geometry = projectPet(turn)
  const lighting = petLighting(palette, turn, frame.shading)
  ctx.save()
  ctx.translate(width / 2 + pose.x * scale, floor)
  ctx.scale(scale, scale)
  ctx.save()
  ctx.globalAlpha = 1 - (pose.lift / PEAK_HOP_LIFT) * 0.55
  drawGroundShadow(ctx, SHADOW_FOOTPRINT, SHADOW_CONFIG, palette)
  ctx.restore()

  ctx.translate(0, (-pose.lift / PEAK_HOP_LIFT) * liftRoom)
  // 侧身/压扁时描边会贴到画布边缘，被裁成一条 1px 细线（向左移动时最明显）。
  // 给描边留半像素余量，并按压扁比例轻微内收，避免裁切露出断线。
  ctx.scale(pose.scaleX * 0.985, pose.scaleY * 0.985)
  ctx.translate(0, -geometry.ground) // 先贴齐底部再压扁，落点不陷入桌面
  for (const part of geometry.parts) paintPart(ctx, part, lighting, frame)
  ctx.restore()
}
