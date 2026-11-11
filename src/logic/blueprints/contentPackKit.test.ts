import { describe, expect, it } from 'vitest'
import type { ContentPack } from './manifest'
import {
  countRegisteredBlocks,
  existingPackBlueprintIds,
  nextContentVersion,
  packBlockCount,
  planAppendedOrder,
  validateContentPackDraft,
  type ContentPackContext
} from './contentPackKit'

/**
 * C3 脚手架：内容包草案校验（不生产内容、不改注册表）。
 * 用合成上下文覆盖 id/版本/追加顺序/座数与块数区间。
 */
const BASE_PACK: ContentPack = {
  id: 'base',
  version: 1,
  releasedAt: '2026-11-10',
  blueprintIds: ['a', 'b']
}

const CONTEXT: ContentPackContext = {
  packs: [BASE_PACK],
  order: ['a', 'b'],
  blockCounts: { a: 100, b: 95, c: 95, d: 85, e: 105, f: 90, g: 110 },
  currentVersion: 2
}

function draft(overrides: Partial<{ id: string; version: number; blueprintIds: string[] }> = {}) {
  return {
    id: 'v3',
    version: 3,
    blueprintIds: ['c', 'd', 'e', 'f', 'g'],
    ...overrides
  }
}

describe('contentPackKit：纯函数', () => {
  it('nextContentVersion 只 +1；默认等于当前 CONTENT_VERSION + 1', () => {
    expect(nextContentVersion(2)).toBe(3)
    expect(nextContentVersion(7)).toBe(8)
  })

  it('planAppendedOrder 把新包追加在既有 order 之后，不改动既有项', () => {
    const order = planAppendedOrder(draft(), ['a', 'b'])
    expect(order).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  })

  it('existingPackBlueprintIds 展开已有包；packBlockCount 未知 id 计 0', () => {
    expect(existingPackBlueprintIds([BASE_PACK])).toEqual(['a', 'b'])
    expect(packBlockCount(['a', 'b'], { a: 100, b: 95 })).toBe(195)
    expect(packBlockCount(['a', 'missing'], { a: 100 })).toBe(100)
  })

  it('真实注册表可统计 23 座 / 2485 块（v3 已落地）', () => {
    const counts = countRegisteredBlocks()
    expect(Object.keys(counts).length).toBe(23)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(2485)
    // 真实注册表上 v3 五座的块数与 CONTENT_VERSION 一致
    expect(counts.bakery).toBe(98)
    expect(counts.bookshop).toBe(104)
    expect(counts.postoffice).toBe(92)
    expect(counts.firestation).toBe(112)
    expect(counts.watertower).toBe(94)
    expect(nextContentVersion()).toBe(4)
  })
})

describe('contentPackKit：validateContentPackDraft', () => {
  it('合法草案通过（5 座 / 485 块 / version=3 / 追加在既有之后）', () => {
    const result = validateContentPackDraft(draft(), { context: CONTEXT })
    expect(result).toEqual({ ok: true, errors: [] })
  })

  it('已发布包默认上下文：候选包含既有蓝图会被拒绝', () => {
    // 默认注册表已到 v3（23 座），下一个合法版本是 4
    const result = validateContentPackDraft({
      id: 'v4',
      version: nextContentVersion(),
      blueprintIds: ['plant']
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toMatch(/已在既有内容包中：plant/)
    expect(result.errors.join('\n')).toMatch(/不得包含既有蓝图/)
    // version = nextContentVersion() 正是默认 CONTENT_VERSION(3) 的 next，不应报版本错误（其余规则错误一次性返回）
    expect(result.errors.join('\n')).not.toMatch(/version 必须为/)
  })

  it('id 非法或与既有包重复时报错', () => {
    const badId = validateContentPackDraft(draft({ id: 'Bad ID' }), { context: CONTEXT })
    expect(badId.ok).toBe(false)
    expect(badId.errors.join('\n')).toMatch(/id 必须是/)
    const dupId = validateContentPackDraft(draft({ id: 'base' }), { context: CONTEXT })
    expect(dupId.errors.join('\n')).toMatch(/重复/)
  })

  it('版本必须等于 nextContentVersion（不能跳号/回退）', () => {
    for (const version of [2, 3.5, 4, 0]) {
      const result = validateContentPackDraft(draft({ version }), { context: CONTEXT })
      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toMatch(/version 必须为 nextContentVersion\(\) = 3/)
    }
  })

  it('blueprintIds 重复 / 未注册 / 已在既有包中均报错', () => {
    const dup = validateContentPackDraft(draft({ blueprintIds: ['c', 'c', 'd', 'e', 'f'] }), {
      context: CONTEXT
    })
    expect(dup.errors.join('\n')).toMatch(/重复/)

    const unknown = validateContentPackDraft(draft({ blueprintIds: ['c', 'd', 'e', 'f', 'zzz'] }), {
      context: CONTEXT
    })
    expect(unknown.errors.join('\n')).toMatch(/未注册：zzz/)

    const existing = validateContentPackDraft(draft({ blueprintIds: ['a', 'c', 'd', 'e'] }), {
      context: CONTEXT
    })
    expect(existing.errors.join('\n')).toMatch(/已在既有内容包中：a/)
  })

  it('座数区间 4–6：3 座或 7 座报错', () => {
    const tooFew = validateContentPackDraft(draft({ blueprintIds: ['c', 'd', 'e'] }), {
      context: CONTEXT
    })
    expect(tooFew.ok).toBe(false)
    const tooMany = validateContentPackDraft(
      draft({ blueprintIds: ['c', 'd', 'e', 'f', 'g', 'a', 'b'] }),
      { context: CONTEXT }
    )
    expect(tooMany.ok).toBe(false)
  })

  it('每座 80–120 块与整包 400–600 块区间可覆盖（供其他规模复用）', () => {
    const small = validateContentPackDraft(draft(), {
      context: CONTEXT,
      rules: {
        minPackBuildings: 1,
        maxPackBuildings: 1,
        minPackBlocks: 1,
        maxPackBlocks: 9999,
        minBlocksPerBuilding: 1,
        maxBlocksPerBuilding: 999
      }
    })
    // 仍会因 5 座 > maxPackBuildings=1 而失败，但块数规则已放宽，错误里不应再有块数区间
    expect(small.errors.join('\n')).toMatch(/座数/)
    expect(small.errors.join('\n')).not.toMatch(/块数/)
  })

  it('候选包保持全部规则错误一次性返回（不被首个错误短路）', () => {
    const result = validateContentPackDraft(
      { id: 'BAD ID', version: 9, blueprintIds: ['c', 'c', 'plant'] },
      { context: CONTEXT }
    )
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(4)
  })
})
