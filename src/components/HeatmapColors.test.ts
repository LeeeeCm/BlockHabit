import { describe, expect, it } from 'vitest'
import { cellColor } from './Heatmap'

/**
 * D-20261124-090（人类要求）：打卡成功的格子改为绿色。
 * 取代 D-20261110-035 的灰阶方案；仍不引入蓝色，空白天保持底板线色。
 */
describe('Heatmap 完成绿色阶（D-20261124-090）', () => {
  it('全完成日满亮 = 完成绿', () => {
    expect(cellColor(1, false)).toBe('var(--progress-green)')
    expect(cellColor(1.4, false)).toBe('var(--progress-green)')
  })

  it('空白天 = 底板线色', () => {
    expect(cellColor(0, false)).toBe('var(--line)')
  })

  it('未来 / 无数据 = 透明', () => {
    expect(cellColor(1, true)).toBe('transparent')
    expect(cellColor(-1, false)).toBe('transparent')
  })

  it('部分完成是完成绿按比例混合，且深浅递增', () => {
    const low = cellColor(0.2, false)
    const high = cellColor(0.8, false)
    expect(low).toContain('color-mix')
    expect(high).toContain('color-mix')
    expect(low).toContain('progress-green')
    expect(high).toContain('progress-green')
    const pct = (s: string) => Number(s.match(/(\d+)%/)?.[1] ?? '0')
    expect(pct(high)).toBeGreaterThan(pct(low))
  })

  it('不再使用墨色或蓝色填充打卡格', () => {
    for (const r of [0.1, 0.5, 0.99, 1]) {
      const c = cellColor(r, false)
      expect(c).not.toContain('--ink')
      expect(c).not.toContain('progress-blue')
    }
  })
})
