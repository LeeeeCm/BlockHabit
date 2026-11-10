/**
 * 建造场景的动画时间线（E5 拆分自 BuildScene.tsx）：
 * 新块慢落 + 果冻回弹、进入页面时的逐层级联、以及时间轴规划。
 * 纯函数（只有 planCascade 读 performance.now() 作为起点），可单测。
 */

export const DROP_MS = 1350
export const DROP_FALL_FRAC = 0.42

/** 级联时每块的总时长（快落 + 果冻） */
export const BLOCK_T = 640
export const CASCADE_FALL_FRAC = 0.53
/** 同层积木完全同时下落（无层内错峰） */
export const LAYER_STAGGER = 0
/** 下一层在前一层落地、回弹进行到该比例后开始下落 */
export const LAYER_OVERLAP = 0.55

export const easeInCubic = (t: number) => t * t * t

/**
 * 果冻回弹（挤压拉伸守体积：压 Y 时胀 X）：
 * t=0 最扁 → 回弹拉高 → 衰减振荡，伴随一次小跳
 */
export function jelly(t: number): { z: number; sx: number; sy: number } {
  const w = -0.34 * Math.cos(t * Math.PI * 3) * (1 - t)
  const hop = 0.55 * Math.max(0, Math.sin(Math.PI * t * 2)) * (1 - t)
  return { z: hop, sx: 1 - w * 0.85, sy: 1 + w }
}

/** 新块动画时间线：加速下落 → 果冻 */
export function animState(p: number): { z: number; sx: number; sy: number } {
  if (p < DROP_FALL_FRAC) {
    const t = easeInCubic(p / DROP_FALL_FRAC)
    return { z: 7 * (1 - t), sx: 1, sy: 1 }
  }
  return jelly((p - DROP_FALL_FRAC) / (1 - DROP_FALL_FRAC))
}

/** 级联单块时间线（更快更硬朗的果冻） */
export function cascadeState(elapsed: number): {
  z: number
  sx: number
  sy: number
  done: boolean
} {
  const e = elapsed / BLOCK_T
  if (e >= 1) return { z: 0, sx: 1, sy: 1, done: true }
  if (e < CASCADE_FALL_FRAC) {
    const t = easeInCubic(e / CASCADE_FALL_FRAC)
    return { z: 4.5 * (1 - t), sx: 1, sy: 1, done: false }
  }
  const j = jelly((e - CASCADE_FALL_FRAC) / (1 - CASCADE_FALL_FRAC))
  return { ...j, done: false }
}

export interface CascadePlan {
  start: number
  starts: number[]
  total: number
}

/** 逐层级联：底层先落，回弹过半后上一层再落（层内微错峰，落在已就位的下层上） */
export function planCascade(blocks: Array<{ z: number }>, count: number): CascadePlan {
  const fall = BLOCK_T * CASCADE_FALL_FRAC
  const jellyDur = BLOCK_T * (1 - CASCADE_FALL_FRAC)
  const starts: number[] = []
  let layerStart = 0
  let layerZ = blocks[0]?.z ?? 0
  let idxInLayer = 0
  for (let i = 0; i < count; i++) {
    const z = blocks[i].z
    if (z !== layerZ) {
      layerStart += fall + jellyDur * LAYER_OVERLAP
      layerZ = z
      idxInLayer = 0
    }
    starts.push(layerStart + idxInLayer * LAYER_STAGGER)
    idxInLayer++
  }
  const total = (starts[count - 1] ?? 0) + BLOCK_T
  return { start: performance.now(), starts, total }
}
