import { describe, it, expect } from 'vitest'
import { nextSlot, isComplete, awardBlock, canSelectBlueprint } from './blueprint'
import { blueprintOrder } from './blueprints'
import type { BlockDef } from '../types'

const blocks: BlockDef[] = [
  { x: 0, y: 0, z: 0, type: 'basic' },
  { x: 1, y: 0, z: 0, type: 'gate' },
  { x: 0, y: 0, z: 1, type: 'basic' },
  { x: 1, y: 0, z: 1, type: 'window' },
]

describe('nextSlot', () => {
  it('returns block at placedCount', () => {
    expect(nextSlot(blocks, 0)).toEqual(blocks[0])
    expect(nextSlot(blocks, 2)).toEqual(blocks[2])
  })

  it('returns null when out of range', () => {
    expect(nextSlot(blocks, 4)).toBeNull()
    expect(nextSlot(blocks, 99)).toBeNull()
    expect(nextSlot([], 0)).toBeNull()
  })
})

describe('isComplete', () => {
  it('complete only when placedCount reaches length', () => {
    expect(isComplete(blocks, 3)).toBe(false)
    expect(isComplete(blocks, 4)).toBe(true)
    expect(isComplete(blocks, 5)).toBe(true)
  })
})

describe('awardBlock', () => {
  it('bonus on multiples of 7', () => {
    expect(awardBlock(7)).toBe(true)
    expect(awardBlock(14)).toBe(true)
  })

  it('no bonus otherwise', () => {
    expect(awardBlock(0)).toBe(false)
    expect(awardBlock(6)).toBe(false)
    expect(awardBlock(8)).toBe(false)
    expect(awardBlock(-7)).toBe(false)
  })
})

describe('canSelectBlueprint（顺序解锁）', () => {
  it('nothing completed → only the first is selectable', () => {
    expect(canSelectBlueprint('plant', [])).toBe(true)
    expect(canSelectBlueprint('coffee', [])).toBe(false)
    expect(canSelectBlueprint('monument', [])).toBe(false)
  })

  it('plant completed → coffee unlocked, later ones still locked', () => {
    expect(canSelectBlueprint('coffee', ['plant'])).toBe(true)
    expect(canSelectBlueprint('camera', ['plant'])).toBe(false)
  })

  it('all completed → everything selectable (revisit)', () => {
    const all = [...blueprintOrder]
    for (const id of all) expect(canSelectBlueprint(id, all)).toBe(true)
  })
  it('unknown id → not selectable', () => {
    expect(canSelectBlueprint('nope', [])).toBe(false)
  })
})
