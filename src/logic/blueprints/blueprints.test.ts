import { describe, it, expect } from 'vitest'
import { blueprints } from './index'
import type { BlockDef } from '../../types'

function validateBlueprint(name: string, blocks: BlockDef[], cx: number, cy: number) {
  describe(`blueprint: ${name}`, () => {
    it('block count between 100 and 250', () => {
      expect(blocks.length).toBeGreaterThanOrEqual(100)
      expect(blocks.length).toBeLessThanOrEqual(250)
    })

    it('has no duplicate coordinates', () => {
      const keys = blocks.map((b) => `${b.x},${b.y},${b.z}`)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('has no floating blocks', () => {
      const occupied = new Set(blocks.map((b) => `${b.x},${b.y},${b.z}`))
      for (const b of blocks) {
        if (b.z === 0) continue
        expect(
          occupied.has(`${b.x},${b.y},${b.z - 1}`),
          `block (${b.x},${b.y},${b.z}) floats`,
        ).toBe(true)
      }
    })

    it('is sorted bottom-up, inner-first', () => {
      for (let i = 1; i < blocks.length; i++) {
        const [a, b] = [blocks[i - 1], blocks[i]]
        if (a.z === b.z) {
          const da = Math.abs(a.x - cx) + Math.abs(a.y - cy)
          const db = Math.abs(b.x - cx) + Math.abs(b.y - cy)
          expect(da).toBeLessThanOrEqual(db)
        } else {
          expect(a.z).toBeLessThan(b.z)
        }
      }
    })

    it('contains accent block types', () => {
      const types = new Set(blocks.map((b) => b.type))
      expect(types.has('flag') || types.has('chimney')).toBe(true)
      expect(types.has('window') || types.has('gate')).toBe(true)
    })
  })
}

validateBlueprint('castle', blueprints.castle.blocks, 4, 4)
validateBlueprint('factory', blueprints.factory.blocks, 5, 3)
