import { describe, expect, it } from 'vitest'
import { cellColor } from './Heatmap'

/**
 * B3（D-20261110-035）：热图必须走灰阶。
 * design/AESTHETIC.md：「日历热图：近 13 周，用灰阶点亮，"全完成日"才允许满亮。」
 * 此前的绿→蓝色阶是第二套色相，与 A1「黑白灰为骨、唯一点缀色」相抵。
 */
describe('Heatmap 灰阶色阶（B3）', () => {
  it('全完成日满亮 = 墨色', () => {
    expect(cellColor(1, false)).toBe('var(--ink)')
    expect(cellColor(1.4, false)).toBe('var(--ink)')
  })

  it('空白天 = 底板线色', () => {
    expect(cellColor(0, false)).toBe('var(--line)')
  })

  it('未来 / 无数据 = 透明', () => {
    expect(cellColor(1, true)).toBe('transparent')
    expect(cellColor(-1, false)).toBe('transparent')
  })

  it('部分完成是墨色按比例混合，且深浅递增', () => {
    const low = cellColor(0.2, false)
    const high = cellColor(0.8, false)
    expect(low).toContain('color-mix')
    expect(high).toContain('color-mix')
    const pct = (s: string) => Number(s.match(/(\d+)%/)?.[1] ?? '0')
    expect(pct(high)).toBeGreaterThan(pct(low))
  })

  it('不再出现绿色/蓝色（绿色只保留给进度条）', () => {
    for (const r of [0, 0.1, 0.5, 0.99, 1]) {
      const c = cellColor(r, false)
      expect(c).not.toContain('progress-green')
      expect(c).not.toContain('progress-blue')
    }
  })
})
