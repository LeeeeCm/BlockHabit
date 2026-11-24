import { describe, expect, it } from 'vitest'
import {
  PET_SIZE,
  clampPetPosition,
  defaultPetPosition,
  nextMoveDelay,
  stepPetWalk
} from './petMotion'

const area = { x: 0, y: 0, width: 1000, height: 800 }

describe('petMotion（D-20261124-088）', () => {
  it('默认位置在工作区右下角', () => {
    expect(defaultPetPosition(area)).toEqual({
      x: 1000 - PET_SIZE.w - 16,
      y: 800 - PET_SIZE.h - 16
    })
  })

  it('位置钳制在工作区内，窗口不会被拖出屏幕', () => {
    expect(clampPetPosition({ x: -50, y: -50 }, area)).toEqual({ x: 8, y: 8 })
    expect(clampPetPosition({ x: 5000, y: 5000 }, area)).toEqual({
      x: 1000 - PET_SIZE.w - 8,
      y: 800 - PET_SIZE.h - 8
    })
  })

  it('走到左边界反弹向右', () => {
    const result = stepPetWalk({ x: 10, y: 500 }, -1, 20, area)
    expect(result.direction).toBe(1)
    expect(result.pos.x).toBe(8)
  })

  it('走到右边界反弹向左', () => {
    const maxX = 1000 - PET_SIZE.w - 8
    const result = stepPetWalk({ x: maxX - 2, y: 500 }, 1, 20, area)
    expect(result.direction).toBe(-1)
    expect(result.pos.x).toBe(maxX)
  })

  it('中间行走保持方向与 y', () => {
    const result = stepPetWalk({ x: 400, y: 500 }, 1, 10, area)
    expect(result.direction).toBe(1)
    expect(result.pos).toEqual({ x: 410, y: 500 })
  })

  it('随机间隔落在 6–16 秒', () => {
    expect(nextMoveDelay(() => 0)).toBe(6000)
    expect(nextMoveDelay(() => 1)).toBe(16000)
  })
})
