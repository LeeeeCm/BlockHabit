import { describe, expect, it } from 'vitest'
import { noBlockReason } from './blockHints'

/**
 * F2（D-20261110-041）：没有掉块时必须能判别原因。
 * 规则：全部落成 > 当前蓝图已满 > 正常。
 */
describe('noBlockReason', () => {
  const base = { completedBlueprints: 0, blueprintTotal: 12, placedCount: 0, activeBlueprintBlocks: 24 }

  it('正常掉块路径 → normal', () => {
    expect(noBlockReason(base)).toBe('normal')
  })

  it('当前蓝图已满、还有下一座 → active-blueprint-complete', () => {
    expect(noBlockReason({ ...base, completedBlueprints: 3, placedCount: 24 })).toBe('active-blueprint-complete')
  })

  it('12 座全部落成 → all-blueprints-complete', () => {
    expect(noBlockReason({ ...base, completedBlueprints: 12, placedCount: 24 })).toBe('all-blueprints-complete')
  })

  it('全部落成优先于「当前蓝图已满」（用户需要知道没有下一座了）', () => {
    const allDone = { completedBlueprints: 12, blueprintTotal: 12, placedCount: 24, activeBlueprintBlocks: 24 }
    expect(noBlockReason(allDone)).toBe('all-blueprints-complete')
  })

  it('完成数超过总数（脏数据）也按全部落成处理，不越界', () => {
    expect(noBlockReason({ ...base, completedBlueprints: 99, placedCount: 24 })).toBe('all-blueprints-complete')
  })
})
