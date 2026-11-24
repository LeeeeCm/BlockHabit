import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  prepareCanvas,
  readCssVar,
  readPrintPalette,
  truncateToWidth,
  wrapTextToWidth
} from './canvasKit'

/** 等宽假 context：每个字符 10px，便于精确断言截断位置 */
function measured(charWidth = 10): Pick<CanvasRenderingContext2D, 'measureText'> {
  return {
    measureText: (text: string) => ({ width: text.length * charWidth }) as TextMetrics
  } as Pick<CanvasRenderingContext2D, 'measureText'>
}

describe('canvasKit 文本原语', () => {
  it('宽度足够时原样返回', () => {
    expect(truncateToWidth(measured(), 'abc', 100)).toBe('abc')
  })

  it('溢出时按宽度截断并补省略号', () => {
    expect(truncateToWidth(measured(), 'abcdef', 50)).toBe('ab...')
  })

  it('minLength 限制最少保留字符数', () => {
    expect(truncateToWidth(measured(), 'abcdefgh', 20, { minLength: 4 })).toBe('abcd...')
  })

  it('ensureEllipsis 复刻相纸/画报“溢出必补省略号”的语义', () => {
    expect(truncateToWidth(measured(), 'abcd', 20, { minLength: 4 })).toBe('abcd')
    expect(truncateToWidth(measured(), 'abcd', 20, { minLength: 4, ensureEllipsis: true })).toBe(
      'abcd...'
    )
  })

  it('折行按宽度切分，末行超宽时截断', () => {
    expect(wrapTextToWidth(measured(), 'abcdefghij', 40, 2)).toEqual(['abcd', 'e...'])
  })

  it('单行可容纳时只返回一行', () => {
    expect(wrapTextToWidth(measured(), 'abc', 100, 2)).toEqual(['abc'])
  })
})

describe('canvasKit 画布与令牌原语', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--print-test')
    document.documentElement.style.removeProperty('--bg')
  })

  it('prepareCanvas 设置物理尺寸并按 DPR 缩放', () => {
    const scale = vi.fn()
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ scale })
    } as unknown as HTMLCanvasElement
    const ctx = prepareCanvas(canvas, 100, 50, 2)
    expect(ctx).not.toBeNull()
    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(100)
    expect(scale).toHaveBeenCalledWith(2, 2)
  })

  it('prepareCanvas 在无 2D context 时返回 null', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
    expect(prepareCanvas(canvas, 10, 10, 2)).toBeNull()
  })

  it('readCssVar 读取主题变量，缺省时回退', () => {
    document.documentElement.style.setProperty('--print-test', '#123456')
    expect(readCssVar('--print-test', '#ffffff')).toBe('#123456')
    expect(readCssVar('--missing-var', '#ffffff')).toBe('#ffffff')
  })

  it('readPrintPalette 使用主题变量并保留纸白回退', () => {
    document.documentElement.style.setProperty('--bg', '#000000')
    const palette = readPrintPalette()
    expect(palette.bg).toBe('#000000')
    expect(palette.surface).toBeTruthy()
    expect(palette.accent).toBeTruthy()
  })
})
