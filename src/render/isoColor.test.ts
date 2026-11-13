import { describe, expect, it } from 'vitest'
import {
  adjustLightness,
  contrastRatio,
  deriveShading,
  deriveShadingForColor,
  floorContrast,
  parseColor,
  relativeLuminance,
  withAlpha,
  type IsoPalette
} from './isoColor'

/**
 * D-20261110-043：颜色域是渲染与可读性的数学底座（E4 拆分后此前只有间接覆盖）。
 * 这里断言的是**可验证的数学性质**（颜色解析、亮度、对比度、单调性），不是具体像素。
 */
describe('parseColor', () => {
  it('解析 6 位与 3 位十六进制', () => {
    expect(parseColor('#f5b301')).toEqual([245, 179, 1])
    expect(parseColor('#fff')).toEqual([255, 255, 255])
    expect(parseColor('#0a0a0a')).toEqual([10, 10, 10])
  })

  it('解析 rgb() / rgba()（透明度忽略）', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30])
    expect(parseColor('rgba(1, 2, 3, 0.42)')).toEqual([1, 2, 3])
    expect(parseColor('  rgb( 5 , 6 , 7 )  ')).toEqual([5, 6, 7])
  })

  it('无法解析返回 null（不抛错）', () => {
    expect(parseColor('var(--ink)')).toBeNull()
    expect(parseColor('nope')).toBeNull()
    expect(parseColor('#12345')).toBeNull()
    expect(parseColor('#zzzzzz')).toBeNull()
  })
})

describe('withAlpha', () => {
  it('把可解析颜色转成 rgba()', () => {
    expect(withAlpha('#000', 0.5)).toBe('rgba(0,0,0,0.5)')
    expect(withAlpha('rgb(10,20,30)', 0.12)).toBe('rgba(10,20,30,0.12)')
  })

  it('不可解析时原样返回（CSS 变量等交给浏览器）', () => {
    expect(withAlpha('var(--ink)', 0.5)).toBe('var(--ink)')
  })
})

describe('adjustLightness', () => {
  it('乘数 1 时颜色基本不变', () => {
    expect(adjustLightness('#808080', 1)).toBe('rgb(128,128,128)')
  })

  it('小于 1 变暗、大于 1 变亮（亮度单调）', () => {
    const base = relativeLuminance('#f5b301')
    expect(relativeLuminance(adjustLightness('#f5b301', 0.5))).toBeLessThan(base)
    expect(relativeLuminance(adjustLightness('#808080', 1.4))).toBeGreaterThan(
      relativeLuminance('#808080')
    )
  })

  it('越界时钳制在 [0,1]（白色再亮仍是白、黑色再暗仍是黑）', () => {
    expect(adjustLightness('#ffffff', 2)).toBe('rgb(255,255,255)')
    expect(adjustLightness('#000000', 0.1)).toBe('rgb(0,0,0)')
  })

  it('不可解析时原样返回', () => {
    expect(adjustLightness('var(--ink)', 0.5)).toBe('var(--ink)')
  })
})

describe('WCAG 对比度', () => {
  it('相对亮度：白=1、黑=0', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6)
  })

  it('黑白对比度为 21:1，同色为 1:1（顺序无关）', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 10)
  })
})

describe('floorContrast', () => {
  it('浅色背景不做改动（避免改变 oat/fog 观感）', () => {
    expect(floorContrast('#111111', '#ffffff', 1.6)).toBe('#111111')
  })

  it('暗底 + 对比度不足时提亮到至少 minRatio', () => {
    const out = floorContrast('#0b0b0b', '#0a0a0a', 1.6)
    expect(contrastRatio(out, '#0a0a0a')).toBeGreaterThanOrEqual(1.6)
    expect(out).not.toBe('#0b0b0b')
  })

  it('暗底但对比度已足够时原样返回', () => {
    expect(floorContrast('#ffffff', '#0a0a0a', 1.6)).toBe('#ffffff')
  })

  it('不可解析输入原样返回', () => {
    expect(floorContrast('var(--x)', '#000000', 1.6)).toBe('var(--x)')
  })
})

describe('明暗派生', () => {
  const palette: IsoPalette = {
    top: '#ffffff',
    left: '#e8e8e8',
    right: '#c8c8c8',
    ghost: '#f0f0f0',
    line: '#dcdcdc',
    accent: '#f5b301',
    ink: '#0a0a0a'
  }

  it('返回七个面/凸点颜色，且三面亮度递减（顶 > 左 > 右）', () => {
    const s = deriveShading(palette)
    for (const v of Object.values(s)) expect(parseColor(v)).not.toBeNull()
    expect(relativeLuminance(s.topA)).toBeGreaterThan(relativeLuminance(s.leftA))
    expect(relativeLuminance(s.leftA)).toBeGreaterThan(relativeLuminance(s.rightA))
  })

  it('同一调色板命中缓存，返回同一对象', () => {
    expect(deriveShading(palette)).toBe(deriveShading(palette))
  })

  it('deriveShadingForColor 确定性：同色同结果，且自缓存', () => {
    const a = deriveShadingForColor('#7a8b6f')
    const b = deriveShadingForColor('#7a8b6f')
    expect(a).toBe(b)
    expect(a).toEqual(deriveShadingForColor('#7a8b6f'))
    expect(relativeLuminance(a.topA)).toBeGreaterThan(relativeLuminance(a.rightB))
  })
})
