import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * D7 守门：字号阶梯。
 * 改前：正文实际用到 10.5/11/11.5/12/12.5/13/13.5 七档（全站 20 档）。
 * 改后：8 档语义令牌，ui.css / mobile.css / 所有 TSX 内联样式一律引用令牌。
 */
const here = dirname(fileURLToPath(import.meta.url))
const theme = readFileSync(join(here, 'theme.css'), 'utf-8')

const TOKENS = ['caption', 'small', 'body', 'subhead', 'title', 'heading', 'display', 'hero']

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkTsx(full, out)
    else if (full.endsWith('.tsx')) out.push(full)
  }
  return out
}

describe('D7 字号阶梯', () => {
  it('theme.css 定义了 8 档字号令牌', () => {
    for (const t of TOKENS) expect(theme).toContain('--fs-' + t + ':')
  })

  it('ui.css / mobile.css 不再有裸 font-size 像素值', () => {
    for (const file of ['components/ui.css', 'mobile.css']) {
      const css = readFileSync(join(here, file), 'utf-8')
      const raw = css.match(/font-size:\s*[0-9.]+px/g) ?? []
      expect(raw, file + ' 仍有裸字号: ' + raw.join(',')).toEqual([])
    }
  })

  it('TSX 内联样式不再有数字 fontSize（全部走令牌）', () => {
    const offenders: string[] = []
    for (const file of walkTsx(here)) {
      if (file.endsWith('.test.tsx')) continue
      const src = readFileSync(file, 'utf-8')
      for (const m of src.matchAll(/fontSize:\s*[0-9]/g)) offenders.push(file.replace(here, '') + ':' + m[0])
    }
    expect(offenders, offenders.join(', ')).toEqual([])
  })

  it('令牌值保持 8 档递增（防止有人随手加档）', () => {
    const values = TOKENS.map((t) => {
      const m = theme.match(new RegExp('--fs-' + t + ':\\s*([0-9.]+)px'))
      return m ? Number(m[1]) : NaN
    })
    expect(values).toEqual([11, 12, 13, 14, 16, 18, 20, 24])
  })
})
