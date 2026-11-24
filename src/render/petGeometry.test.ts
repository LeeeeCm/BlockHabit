import { describe, expect, it } from 'vitest'
import { projectPet, type PetModel } from './petGeometry'

const models: PetModel[] = ['block', 'cat', 'bot']

function faceOf(model: PetModel, turn: number) {
  const parts = projectPet(model, turn).parts.filter((part) => part.face)
  expect(parts).toHaveLength(1)
  return parts[0]
}

describe('桌宠投影', () => {
  it.each(models)('%s 静止时只用一块水平正面画脸，不露竖直侧面', (model) => {
    const face = faceOf(model, 0)
    expect(face.front[0][1]).toBeCloseTo(face.front[1][1])
    expect(face.front[0][0]).toBeCloseTo(face.front[3][0])
    expect(face.front[0][0]).toBeLessThan(face.front[1][0])
    expect(
      projectPet(model, 0)
        .parts.flatMap((part) => part.facets)
        .every((facet) => facet.kind === 'top')
    ).toBe(true)
  })

  it.each([
    [-1, 12],
    [1, -12]
  ])('转向 %s 时把同一个正面投影到等距斜面', (turn, rise) => {
    const block = faceOf('block', turn)
    const [left, right] = block.front
    expect(right[0] - left[0]).toBeCloseTo(24)
    expect(right[1] - left[1]).toBeCloseTo(rise)
    expect(((left[0] + right[0]) / 2) * turn).toBeGreaterThan(0)
    const side = block.facets.filter((facet) => facet.kind === 'side')
    expect(side).toHaveLength(1)
    expect(side[0].points).toContainEqual(turn < 0 ? right : left)
  })

  it('让猫有双耳和短尾，让机器人有独立方头和短臂', () => {
    expect(projectPet('cat', 0).parts.map((part) => part.name)).toEqual(
      expect.arrayContaining(['leftEar', 'rightEar', 'tailBase', 'tailTip'])
    )
    expect(projectPet('bot', 0).parts.map((part) => part.name)).toEqual(
      expect.arrayContaining(['head', 'leftArm', 'rightArm', 'torso'])
    )
    expect(faceOf('bot', 0).name).toBe('head')
  })

  it.each([
    [-1, 'leftArm', 'rightArm'],
    [1, 'rightArm', 'leftArm']
  ] as const)('在转向 %s 时让近侧短臂盖住躯干边缘，远侧在其后', (turn, farArm, nearArm) => {
    const layers = projectPet('bot', turn).parts.map((part) => part.name)
    expect(layers.indexOf(farArm)).toBeLessThan(layers.indexOf('torso'))
    expect(layers.indexOf(nearArm)).toBeGreaterThan(layers.indexOf('torso'))
  })

  it.each([-1, 1])('在转向 %s 时不让猫头顶遮住其上方的耳朵', (turn) => {
    const layers = projectPet('cat', turn).parts.map((part) => part.name)
    expect(layers.indexOf('leftEar')).toBeGreaterThan(layers.indexOf('body'))
    expect(layers.indexOf('rightEar')).toBeGreaterThan(layers.indexOf('body'))
  })

  it.each(models)('%s 的底部锚点跟随最接近地面的轮廓', (model) => {
    for (const turn of [-1, -0.5, 0, 0.5, 1]) {
      const { parts, ground } = projectPet(model, turn)
      expect(
        Math.max(...parts.flatMap((part) => part.outline.map((point) => point[1] - ground)))
      ).toBeCloseTo(0)
    }
  })
})
