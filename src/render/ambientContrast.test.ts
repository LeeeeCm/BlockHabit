import { describe, it, expect } from 'vitest'
import {
  applyAmbientLighting,
  adjustLightness,
  contrastRatio,
  floorContrast,
  relativeLuminance,
  type IsoPalette,
} from './iso'

/**
 * C4 回归：环境光暗化后的对比度地板。
 * 背景：2026-10-03 修好了墨黑主题积木与背景同色的问题（右脸 #0f0f0f → #1c1c1c），
 * 但随后的「时段感知环境光」在夜间把右脸再乘 0.55 → 与 #0a0a0a 背景只有 1.03:1，
 * 等于把修复又抵消了。现在：环境光可以让块面更亮，但不允许比「标准光照」更看不清。
 */
const THEMES: Record<string, { bg: string; base: IsoPalette }> = {
  light: {
    bg: '#fafafa',
    base: { top: '#f4f4f4', left: '#c9c9c9', right: '#8a8a8a', ghost: '#dcdcdc', line: '#e8e8e8', accent: '#f5b301', ink: '#0a0a0a' },
  },
  dark: {
    bg: '#0a0a0a',
    base: { top: '#424242', left: '#303030', right: '#1c1c1c', ghost: '#262626', line: '#2b2b2b', accent: '#f5b301', ink: '#fafafa' },
  },
  oat: {
    bg: '#f7f4ee',
    base: { top: '#fbf9f5', left: '#dfd8cc', right: '#574f45', ghost: '#dfd8cc', line: '#e7e2d7', accent: '#c25e3e', ink: '#292524' },
  },
  fog: {
    bg: '#f1f4f8',
    base: { top: '#f8fafc', left: '#cbd5e1', right: '#334155', ghost: '#cbd5e1', line: '#cbd5e1', accent: '#0284c7', ink: '#1e293b' },
  },
}

describe('对比度工具', () => {
  it('黑白对比度为 21:1，同色为 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5)
  })

  it('相对亮度单调：越亮值越大', () => {
    expect(relativeLuminance('#ffffff')).toBeGreaterThan(relativeLuminance('#888888'))
    expect(relativeLuminance('#888888')).toBeGreaterThan(relativeLuminance('#000000'))
  })

  it('floorContrast 对暗底提亮到目标对比度，对浅底原样返回', () => {
    const raised = floorContrast('#0f0f0f', '#0a0a0a', 1.16)
    expect(contrastRatio(raised, '#0a0a0a')).toBeGreaterThanOrEqual(1.15)
    // 浅色主题不做兜底：避免改动 oat / fog 既有的浅色面观感
    expect(floorContrast('#dfd8cc', '#f7f4ee', 3)).toBe('#dfd8cc')
  })
})

describe('环境光对比度地板（C4）', () => {
  it('墨黑主题夜间：右/左脸不再低于标准光照的对比度', () => {
    const { bg, base } = THEMES.dark
    const noon = contrastRatio(base.right, bg)
    const night = applyAmbientLighting(base, 'night', bg)
    expect(contrastRatio(night.right, bg)).toBeGreaterThanOrEqual(noon - 0.001)
    expect(contrastRatio(night.left, bg)).toBeGreaterThanOrEqual(contrastRatio(base.left, bg) - 0.001)
    // 且明显高于修复前的 1.03:1
    expect(contrastRatio(night.right, bg)).toBeGreaterThan(1.1)
  })

  it('墨黑主题黄昏：同样不跌破标准光照', () => {
    const { bg, base } = THEMES.dark
    const dusk = applyAmbientLighting(base, 'dusk', bg)
    expect(contrastRatio(dusk.right, bg)).toBeGreaterThanOrEqual(contrastRatio(base.right, bg) - 0.001)
  })

  it('浅色主题（纸白/燕麦/雾灰）的暗化结果完全不受影响', () => {
    for (const name of ['light', 'oat', 'fog']) {
      const { bg, base } = THEMES[name]
      for (const period of ['dusk', 'night'] as const) {
        const out = applyAmbientLighting(base, period, bg)
        const mult = period === 'dusk' ? { left: 0.84, right: 0.68 } : { left: 0.68, right: 0.55 }
        expect(out.left, name + period).toBe(adjustLightness(base.left, mult.left))
        expect(out.right, name + period).toBe(adjustLightness(base.right, mult.right))
      }
    }
  })

  it('标准光照（noon）对四主题都是恒等变换', () => {
    for (const name of Object.keys(THEMES)) {
      const { bg, base } = THEMES[name]
      expect(applyAmbientLighting(base, 'noon', bg)).toEqual(base)
    }
  })

  it('晨曦仍然只做提亮，不触发地板', () => {
    const { bg, base } = THEMES.dark
    const dawn = applyAmbientLighting(base, 'dawn', bg)
    expect(dawn.top).toBe(adjustLightness(base.top, 1.14))
    expect(dawn.right).toBe(adjustLightness(base.right, 0.9))
  })
})
