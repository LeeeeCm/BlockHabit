import { describe, it, expect } from 'vitest'
import { worldToScreen, depth, type IsoConfig } from './iso'

describe('worldToScreen', () => {
  const c: IsoConfig = { tileW: 64, tileH: 32, blockH: 24 }

  it('origin maps to (0,0)', () => {
    expect(worldToScreen(0, 0, 0, c)).toEqual({ sx: 0, sy: 0 })
  })

  it('+x goes right-down, +y goes left-down (symmetric)', () => {
    const a = worldToScreen(1, 0, 0, c)
    const b = worldToScreen(0, 1, 0, c)
    expect(a).toEqual({ sx: 32, sy: 16 })
    expect(b).toEqual({ sx: -32, sy: 16 })
  })

  it('+z raises sy only', () => {
    const p = worldToScreen(2, 3, 1, c)
    const q = worldToScreen(2, 3, 0, c)
    expect(p.sx).toBe(q.sx)
    expect(p.sy).toBe(q.sy - 24)
  })
})

describe('depth', () => {
  it('orders cubes for painter algorithm', () => {
    expect(depth(0, 0, 0)).toBeLessThan(depth(0, 0, 1))
    expect(depth(0, 0, 1)).toBeLessThan(depth(1, 1, 0))
    expect(depth(1, 1, 1)).toBe(3)
  })
})
