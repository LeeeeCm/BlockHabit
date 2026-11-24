import { DEFAULT_ISO_CONFIG } from './isoGeometry'
import { easeInCubic, jelly } from './sceneMotion'

export type PetDirection = -1 | 1

export interface PetPose {
  x: number
  lift: number
  turn: number
  scaleX: number
  scaleY: number
}

export const PET_REST_POSE: Readonly<PetPose> = { x: 0, lift: 0, turn: 0, scaleX: 1, scaleY: 1 }
export const PEAK_HOP_LIFT = DEFAULT_ISO_CONFIG.blockH * 0.55
const HOP_DISTANCE = DEFAULT_ISO_CONFIG.tileW / 3
const AIR_MS = 240 // ART §6 的短落块时长
const SETTLE_MS = 2 * 80 // 压缩、回弹各一个微反馈档
const LANDING_SQUASH = 0.45

/** 返回 null 即停止排帧，最后一帧重绘正视静止态。 */
export function petHopPose(elapsedMs: number, direction: PetDirection): Readonly<PetPose> | null {
  if (elapsedMs <= 0) return PET_REST_POSE
  if (elapsedMs >= AIR_MS + SETTLE_MS) return null
  const destination = direction * HOP_DISTANCE
  if (elapsedMs < AIR_MS) {
    const time = elapsedMs / AIR_MS
    const arc = 4 * time * (1 - time)
    return {
      ...PET_REST_POSE,
      x: destination * (1 - easeInCubic(1 - time)),
      lift: PEAK_HOP_LIFT * arc,
      turn: direction * arc
    }
  }
  const time = (elapsedMs - AIR_MS) / SETTLE_MS
  const { sx, sy } = jelly(time)
  return {
    ...PET_REST_POSE,
    x: destination * (1 - time * time * (3 - 2 * time)),
    scaleX: 1 + (sx - 1) * LANDING_SQUASH,
    scaleY: 1 + (sy - 1) * LANDING_SQUASH
  }
}
