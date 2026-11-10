import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 主题 token 回归测试：四套主题（纸白 :root / 墨黑 / 燕麦 / 雾灰）必须定义全部积木调色板。
 * 背景：纸白主题曾漏掉 --block-right / --block-ghost，空字符串传入 canvas 渐变
 * addColorStop 抛 SyntaxError，建造页与落块弹窗整树卸载白屏（2026-10-03 评审 #1）。
 *
 * 注：本测试读磁盘文件（node:fs），从 tsconfig exclude 排除类型检查
 *   （同 webdav.e2e.test.ts 的处理）；vitest 运行时可直接用 node 内建模块。
 */
const here = dirname(fileURLToPath(import.meta.url))
const themeCss = readFileSync(join(here, 'theme.css'), 'utf-8')

const THEMES: Array<{ selector: string; label: string }> = [
  { selector: ':root', label: '纸白' },
  { selector: ":root[data-theme='dark']", label: '墨黑' },
  { selector: ":root[data-theme='oat']", label: '燕麦' },
  { selector: ":root[data-theme='fog']", label: '雾灰' },
]
const TOKENS = ['--block-top', '--block-left', '--block-right', '--block-ghost']

/** 截取某主题选择器块内的 CSS 文本（从选择器起到大括号闭合） */
function themeBlock(selector: string): string {
  const idx = themeCss.indexOf(selector)
  expect(idx, `theme.css 应包含选择器 ${selector}`).toBeGreaterThanOrEqual(0)
  const open = themeCss.indexOf('{', idx)
  let depth = 1
  let end = open + 1
  while (depth > 0 && end < themeCss.length) {
    if (themeCss[end] === '{') depth++
    if (themeCss[end] === '}') depth--
    end++
  }
  return themeCss.slice(open + 1, end - 1)
}

describe('theme.css 积木调色板完整性', () => {
  for (const { selector, label } of THEMES) {
    it(`${label}（${selector}）定义全部四面 token 且为合法颜色`, () => {
      const block = themeBlock(selector)
      for (const token of TOKENS) {
        const m = block.match(new RegExp(`${token}\\s*:\\s*([^;]+);`))
        expect(m, `${label} 缺少 ${token}`).not.toBeNull()
        const value = m![1].trim()
        // canvas addColorStop 对空串/非法颜色直接抛异常，这里兜底校验非空 + 十六进制/颜色格式
        expect(value, `${label} 的 ${token} 不应为空`).not.toBe('')
        expect(value).toMatch(/^(#[0-9a-fA-F]{3,8}|rgba?\(.+\)|var\(.+\))$/)
      }
    })
  }
})
