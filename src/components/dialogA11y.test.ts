import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * C7 守门：每个 role="dialog" 的弹窗元素自身必须有可访问名称。
 * 源码级扫描（只检查 role="dialog" 附近的属性，避免"文件里别处有 aria-label"就误判通过）。
 */
const here = dirname(fileURLToPath(import.meta.url))
const DIALOGS = [
  'BlockDropModal',
  'BottomSheet',
  'ConfirmDialog',
  'FoundationNoteDialog',
  'GalleryDialog',
  'HabitDialog',
  'MonthlyPosterModal',
  'PolaroidModal',
  'ReminderDialog',
  'SettingsDialog',
]

describe('弹窗可访问名称（C7）', () => {
  for (const name of DIALOGS) {
    it(`${name} 的 role="dialog" 元素自身有可访问名称`, () => {
      const src = readFileSync(join(here, `${name}.tsx`), 'utf-8')
      const at = src.indexOf('role="dialog"')
      expect(at, `${name} 未找到 role="dialog"`).toBeGreaterThanOrEqual(0)
      // 取 role="dialog" 之后 260 个字符（该元素的属性区）判定
      const nearby = src.slice(at, at + 260)
      const named = /aria-label=\{|aria-label="|aria-labelledby=/.test(nearby)
      expect(named, `${name} 的对话框元素缺少 aria-label / aria-labelledby`).toBe(true)
    })
  }
})
