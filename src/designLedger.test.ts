import { describe, expect, it } from 'vitest'

// 设计台账守门：把 design/README.md 的纪律接进 npm test。
// 该文件使用 node:fs / 子进程，按仓库惯例（同 theme.test.ts）在 tsconfig.json 中被 exclude。
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { checkDesignLedger, parseFrontMatter, STATUSES } from '../scripts/design-ledger.mjs'

describe('design ledger（设计台账守门）', () => {
  it('design/ 设计中枢完整，所有记录已登记且状态合法', () => {
    const result = checkDesignLedger()
    if (!result.ok) {
      throw new Error('设计台账校验失败：\n' + result.errors.map((e) => '  - ' + e).join('\n'))
    }
    expect(result.ok).toBe(true)
    expect(result.records.length).toBeGreaterThan(0)
  })

  it('每条记录都有唯一的 D-YYYYMMDD-NNN 编号', () => {
    const { records } = checkDesignLedger()
    const ids = records.map((r) => r.id).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^D-\d{8}-\d{3}$/)
  })

  it('不存在被删除却未经人工批准的设计记录（对照 git HEAD）', () => {
    const { errors } = checkDesignLedger()
    const deletionErrors = errors.filter((e) => e.includes('未审批删除'))
    expect(deletionErrors).toEqual([])
  })

  it('front-matter 解析器能识别非法状态与缺失字段', () => {
    const ok = parseFrontMatter(['---', 'id: D-20261110-999', 'status: proposed', '---', '', '正文'.repeat(80)].join('\n'))
    expect(ok.data?.id).toBe('D-20261110-999')
    expect(STATUSES).toContain(ok.data?.status)
    const broken = parseFrontMatter('# 没有 front-matter 的文件')
    expect(broken.error).toBeTruthy()
  })
})
