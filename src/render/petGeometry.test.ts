import { describe, expect, it } from 'vitest'
import { projectPet } from './petGeometry'

function faceOf(turn: number) {
  const parts = projectPet(turn).parts.filter((part) => part.face)
  expect(parts).toHaveLength(1)
  return parts[0]
}

describe('桌宠投影（D-20261127-125：只保留积木桌宠）', () => {
  it('静止时只用一块水平正面画脸，不露竖直侧面', () => {
    const face = faceOf(0)
    expect(face.front[0][1]).toBeCloseTo(face.front[1][1])
    expect(face.front[0][0]).toBeCloseTo(face.front[3][0])
    expect(face.front[0][0]).toBeLessThan(face.front[1][0])
    expect(
      projectPet(0)
        .parts.flatMap((part) => part.facets)
        .every((facet) => facet.kind === 'top')
    ).toBe(true)
  })

  it.each([
    [-1, 12],
    [1, -12]
  ])('转向 %s 时把同一个正面投影到等距斜面', (turn, rise) => {
    const block = faceOf(turn)
    const [left, right] = block.front
    expect(right[0] - left[0]).toBeCloseTo(24)
    expect(right[1] - left[1]).toBeCloseTo(rise)
    expect(((left[0] + right[0]) / 2) * turn).toBeGreaterThan(0)
    const side = block.facets.filter((facet) => facet.kind === 'side')
    expect(side).toHaveLength(1)
    expect(side[0].points).toContainEqual(turn < 0 ? right : left)
  })

  it('只有一块积木本体与一枚凸点', () => {
    const { parts } = projectPet(0)
    expect(parts.map((part) => part.name)).toEqual(['body'])
    expect(parts[0].stud).toBeDefined()
  })

  it.each([-1, -0.5, 0, 0.5, 1])('底部锚点跟随最接近地面的轮廓（turn=%s）', (turn) => {
    const { parts, ground } = projectPet(turn)
    expect(
      Math.max(...parts.flatMap((part) => part.outline.map((point) => point[1] - ground)))
    ).toBeCloseTo(0)
  })
})
