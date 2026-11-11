import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrastRatio } from './render/iso'

/**
 * C3 守门：彩色填充上的文字、彩色文字，都必须满足 WCAG AA。
 * - 填充上的文字（on-accent / on-success / on-danger）≥ 4.5:1
 * - 彩色文字（accent-text / success-text）在其所在背景（surface）上 ≥ 4.5:1
 * 与 theme.test.ts 同惯例：读磁盘 CSS 原文，tsconfig 里 exclude。
 */
const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, 'theme.css'), 'utf-8')

/** 从某个主题块里取令牌值 */
function themeVars(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error('selector not found: ' + selector)
  const body = css.slice(start, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim()
  }
  return out
}

const ROOT = themeVars(':root {')
const THEMES: Array<[string, Record<string, string>]> = [
  ['light', ROOT],
  ['dark', { ...ROOT, ...themeVars(":root[data-theme='dark'] {") }],
  ['oat', { ...ROOT, ...themeVars(":root[data-theme='oat'] {") }],
  ['fog', { ...ROOT, ...themeVars(":root[data-theme='fog'] {") }],
]

describe('彩色令牌对比度（C3）', () => {
  for (const [label, v] of THEMES) {

    it(`${label}: 填充上的文字 ≥ 4.5:1`, () => {
      expect(contrastRatio(v['--on-accent'], v['--accent'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(v['--on-success'], v['--progress-green'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(v['--on-danger'], v['--danger'])).toBeGreaterThanOrEqual(4.5)
    })

    it(`${label}: 彩色文字在 surface 上 ≥ 4.5:1`, () => {
      expect(contrastRatio(v['--accent-text'], v['--surface'])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(v['--success-text'], v['--surface'])).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('填充上的文字不再出现「白字压中低明度填充」的旧写法', () => {
    // E4 拆分后逐文件拼接，保证正则仍能命中原始规则文本
    const uiCss = readdirSync(join(here, 'components'))
      .filter((f) => /^ui(-[a-z]+)?\.css$/.test(f))
      .map((f) => readFileSync(join(here, 'components', f), 'utf-8'))
      .join('\n')
    // 旧的硬编码白字（review 时被点名的两处）已改为令牌
    expect(uiCss).not.toMatch(/\.pill-action\.success:hover[\s\S]{0,80}color: #ffffff/)
    expect(uiCss).not.toMatch(/\.checkin-float-pill[\s\S]{0,120}color: var\(--surface\)/)
  })
})
