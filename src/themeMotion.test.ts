import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * C1 / C2 守门：动效令牌、减少动态偏好降级、键盘焦点环。
 * 与 theme.test.ts 同惯例：读磁盘 CSS 原文（vitest 会把 CSS import mock 成空串），
 * 并在 tsconfig.json 中被 exclude（同 theme.test.ts / webdav.e2e.test.ts）。
 */
const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, 'theme.css'), 'utf-8')

describe('theme.css 无障碍基线（C1/C2）', () => {
  it('提供动效令牌（时长 7 档 + 缓动 4 档）', () => {
    for (const token of [
      '--dur-2xs', '--dur-xs', '--dur-sm', '--dur-md', '--dur-lg', '--dur-xl', '--dur-scene',
      '--ease-default', '--ease-standard', '--ease-out', '--ease-bounce',
    ]) {
      expect(css).toContain(token + ':')
    }
  })

  it('响应 prefers-reduced-motion：全部时长令牌归零并有全局兜底', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const token of ['--dur-2xs', '--dur-xs', '--dur-sm', '--dur-md', '--dur-lg', '--dur-xl', '--dur-scene']) {
      expect(block).toContain(token + ': 0ms')
    }
    expect(block).toContain('animation-duration: 0.01ms !important')
    expect(block).toContain('transition-duration: 0.01ms !important')
  })

  /**
   * D3 收口：ui.css / mobile.css 里不允许再出现裸时长与裸贝塞尔。
   * （动画迭代/填充等关键字允许：linear / ease-in / forwards / both / infinite）
   */
  it('ui*.css 与 mobile.css 不再有裸时长/裸贝塞尔（全部走令牌）', () => {
    // E4 把 ui.css 拆成 ui-*.css；守门测试必须覆盖拆分后的全部文件，否则等于把闸门拆了
    const uiFiles = readdirSync(join(here, 'components'))
      .filter((f) => /^ui(-[a-z]+)?\.css$/.test(f))
      .map((f) => 'components/' + f)
    expect(uiFiles.length).toBeGreaterThanOrEqual(5)
    for (const file of [...uiFiles, 'mobile.css']) {
      const src = readFileSync(join(here, file), 'utf-8')
      const rawDurations = src.match(/(?<![\w-])\d+(?:\.\d+)?m?s(?![\w-])/g) ?? []
      const rawBeziers = src.match(/cubic-bezier\(/g) ?? []
      expect(rawDurations, file + ' 仍有裸时长: ' + rawDurations.join(',')).toEqual([])
      expect(rawBeziers, file + ' 仍有裸贝塞尔').toEqual([])
    }
  })

  it('提供键盘焦点环，且只用令牌颜色（不新增色相）', () => {
    expect(css).toContain(':focus-visible')
    const block = css.slice(css.indexOf(':focus-visible'))
    expect(block).toContain('outline: 2px solid var(--ink)')
    expect(block).toContain('outline-offset: 2px')
    expect(block.slice(0, 240)).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('四主题仍然完整（防止改 CSS 时误删主题块）', () => {
    for (const theme of ["[data-theme='dark']", "[data-theme='oat']", "[data-theme='fog']"]) {
      expect(css).toContain(theme)
    }
  })
})
