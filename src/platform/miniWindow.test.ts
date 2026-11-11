import { afterEach, describe, expect, it } from 'vitest'
import {
  MINI_PRESETS,
  MINI_SIZE_ORDER,
  clampMiniPosition,
  defaultMiniPosition,
  loadWindowLayout,
  presetFits,
  saveWindowLayout,
  WINDOW_LAYOUT_KEY,
} from './miniWindow'

const AREA = { x: 0, y: 0, width: 1920, height: 1040 }

afterEach(() => {
  try { localStorage.removeItem(WINDOW_LAYOUT_KEY) } catch { /* jsdom 之外忽略 */ }
})

describe('mini presets', () => {
  it('all three presets fit their header/stage/footer budget', () => {
    for (const size of MINI_SIZE_ORDER) expect(presetFits(MINI_PRESETS[size])).toBe(true)
  })

  it('keeps the documented sizes and decreasing density', () => {
    expect(MINI_PRESETS.pocket.w).toBe(220)
    expect(MINI_PRESETS.standard.w).toBe(280)
    expect(MINI_PRESETS.display.w).toBe(420)
    expect(MINI_PRESETS.pocket.maxPills).toBeLessThan(MINI_PRESETS.standard.maxPills)
    expect(MINI_PRESETS.standard.maxPills).toBeLessThan(MINI_PRESETS.display.maxPills)
  })
})

describe('position helpers', () => {
  it('places the mini window at the bottom-right with margin', () => {
    expect(defaultMiniPosition(AREA, MINI_PRESETS.standard)).toEqual({ x: 1920 - 280 - 16, y: 1040 - 400 - 16 })
  })

  it('clamps positions outside the work area back inside', () => {
    const p = clampMiniPosition({ x: 5000, y: -200 }, AREA, MINI_PRESETS.standard)
    expect(p.x).toBe(1920 - 280 - 8)
    expect(p.y).toBe(8)
  })

  it('handles a work area smaller than the preset without NaN', () => {
    const p = clampMiniPosition({ x: 10, y: 10 }, { x: 0, y: 0, width: 200, height: 120 }, MINI_PRESETS.standard)
    expect(Number.isFinite(p.x)).toBe(true)
    expect(Number.isFinite(p.y)).toBe(true)
  })
})

describe('window layout persistence', () => {
  it('round-trips main and mini positions', () => {
    saveWindowLayout({ version: 1, main: { w: 1200, h: 800, x: 40, y: 60 }, mini: { x: 900, y: 300 } })
    expect(loadWindowLayout()).toEqual({ version: 1, main: { w: 1200, h: 800, x: 40, y: 60 }, mini: { x: 900, y: 300 } })
  })

  it('falls back to empty layout on bad JSON / missing keys', () => {
    localStorage.setItem(WINDOW_LAYOUT_KEY, '{oops')
    expect(loadWindowLayout()).toEqual({ version: 1 })
    localStorage.setItem(WINDOW_LAYOUT_KEY, JSON.stringify({ main: { w: 'x' } }))
    expect(loadWindowLayout()).toEqual({ version: 1 })
  })
})
