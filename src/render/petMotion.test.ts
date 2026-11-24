import { describe, expect, it } from 'vitest'
import { petHopPose } from './petMotion'

describe('桌宠短跳', () => {
  it('左右弧线镜像，只在空中转头', () => {
    const start = petHopPose(0, -1)
    const left = petHopPose(120, -1)
    const right = petHopPose(120, 1)
    expect(start).toMatchObject({ x: 0, lift: 0, turn: 0 })
    expect(left?.x).toBeLessThan(0)
    expect(left?.lift).toBeGreaterThan(0)
    expect(left?.turn).toBeCloseTo(-1)
    expect(right?.x).toBeCloseTo(-(left?.x ?? 0))
    expect(right?.lift).toBeCloseTo(left?.lift ?? 0)
    expect(right?.turn).toBeCloseTo(1)
    expect(petHopPose(210, 1)?.lift).toBeLessThan(right?.lift ?? 0)
  })

  it('落地向下压缩，在地面回弹并停止排帧', () => {
    const squash = petHopPose(240, 1)
    const rebound = petHopPose(290, 1)
    expect(squash).toMatchObject({ lift: 0, turn: 0 })
    expect(squash?.scaleY).toBeLessThan(1)
    expect(squash?.scaleX).toBeGreaterThan(1)
    expect(rebound).toMatchObject({ lift: 0, turn: 0 })
    expect(rebound?.scaleY).toBeGreaterThan(1)
    expect(petHopPose(400, 1)).toBeNull()
  })
})
