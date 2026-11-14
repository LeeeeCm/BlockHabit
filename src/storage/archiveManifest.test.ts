import { describe, expect, it } from 'vitest'
import { buildBuildingsReadme, type ArchiveBuilding } from './archiveManifest'

/**
 * D-20261115-079：CodeQL js/incomplete-sanitization 首次扫描发现 README 表格转义没有处理反斜杠。
 * 这里锁住转义顺序：先反斜杠、再竖线、最后换行 —— 单元格不会被拆开。
 */

function buildings(note: string): ArchiveBuilding[] {
  return [{ blueprintId: 'plant', completedAt: '2026-01-01', blocks: 9, foundationNote: note }]
}

describe('buildBuildingsReadme：Markdown 表格转义', () => {
  it('普通铭言原样写入表格（既有行为不变）', () => {
    const out = buildBuildingsReadme(buildings('从一颗种子开始。'))
    expect(out).toContain('| 1 | plant |')
    expect(out).toContain('从一颗种子开始。')
  })

  it('竖线被转义，不会拆开单元格', () => {
    const out = buildBuildingsReadme(buildings('a|b'))
    expect(out).toContain('a\\|b')
  })

  it('反斜杠先被转义，避免把竖线的转义吃掉（回归 CodeQL 告警）', () => {
    const out = buildBuildingsReadme(buildings(String.raw`a\|b`))
    // 输入 a\|b → 反斜杠变 \\、竖线变 \|，最终 a\\\|b
    expect(out).toContain(String.raw`a\\\|b`)
  })

  it('换行折叠为空格（表格行不被截断）', () => {
    const out = buildBuildingsReadme(buildings('第一行\n第二行'))
    expect(out).toContain('第一行 第二行')
    expect(out.split('\n').some((line) => line.startsWith('| 1 |'))).toBe(true)
  })
})
