import { describe, it, expect } from 'vitest'
import { prepareImport } from './adapter'

/**
 * A5 回归：v1 旧档必须能被「设置 → 导入备份」接受。
 * 旧实现 UI 预检直接用 validateState，v1 的 dayClaims: string[] 会被判非法 → 合法旧备份无法恢复。
 */
function v1Archive() {
  return {
    schemaVersion: 1,
    habits: [{ id: 'h1', name: '读书', frequency: { type: 'daily' }, createdAt: '2026-01-01T00:00:00.000Z' }],
    checkIns: [
      {
        id: 'c1',
        habitId: 'h1',
        date: '2026-01-02',
        at: '2026-01-02T08:00:00.000Z',
        placedBlockId: 'b1',
        rewardBlockIndex: 0,
      },
    ],
    builds: [
      {
        id: 'b1',
        blueprintId: 'plant',
        index: 0,
        placedAt: '2026-01-02T08:00:00.000Z',
        fromHabitId: 'h1',
        bonus: false,
      },
      // v1 的全勤块：fromHabitId 为 '__day__'，迁移时按日期匹配回填 blockId
      {
        id: 'bDay',
        blueprintId: 'plant',
        index: 1,
        placedAt: '2026-01-02T12:00:00.000Z',
        fromHabitId: '__day__',
        bonus: true,
      },
    ],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: { theme: 'light', language: 'zh' },
    // v1 形态：字符串数组
    dayClaims: ['2026-01-02'],
  }
}

describe('旧档导入（A5）', () => {
  it('prepareImport 接受 v1 档并迁移为 v2', () => {
    const state = prepareImport(v1Archive())
    expect(state).not.toBeNull()
    expect(state!.schemaVersion).toBe(2)
    expect(state!.dayClaims).toHaveLength(1)
    expect(state!.dayClaims[0].date).toBe('2026-01-02')
    expect(state!.dayClaims[0].blockId).toBe('bDay')
    // 打卡回填蓝图，供投影重建使用
    expect(state!.checkIns[0].blueprintId).toBe('plant')
  })

  it('prepareImport 拒绝损坏档', () => {
    expect(prepareImport({ schemaVersion: 2, habits: 'nope' })).toBeNull()
  })
})
