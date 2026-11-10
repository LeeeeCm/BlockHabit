import { describe, expect, it } from 'vitest'
import { detectStorageBackend, formatDiagnosticsReport, summarizeData } from './diagnostics'
import type { AppState } from '../types'

/**
 * F9：本地诊断包。
 * 铁律：只读本地数据，不联网；输出人可读纯文本。
 */
function fakeState(over: Partial<AppState> = {}): AppState {
  return {
    schemaVersion: 2,
    habits: [
      { id: 'h1', name: 'A', frequency: { type: 'daily' }, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'h2', name: 'B', frequency: { type: 'daily' }, createdAt: '2026-01-01T00:00:00.000Z', archivedAt: '2026-02-01T00:00:00.000Z' },
    ],
    checkIns: [{ id: 'c1', habitId: 'h1', date: '2026-01-02', at: '2026-01-02T08:00:00.000Z' }],
    builds: [
      { id: 'b1', blueprintId: 'plant', index: 0, placedAt: '2026-01-02T08:00:00.000Z', fromHabitId: 'h1', bonus: false },
    ],
    activeBlueprintId: 'plant',
    completedBlueprintIds: ['coffee'],
    settings: { theme: 'dark', language: 'zh' },
    dayClaims: [{ date: '2026-01-02', claimedAt: '2026-01-02T09:00:00.000Z', blockId: 'b1', blueprintId: 'plant' }],
    repairBricks: 3,
    foundationNotes: { plant: 'note' },
    reminderLog: { h1: '2026-01-02' },
    ...over,
  } as AppState
}

describe('diagnostics · 数据体量汇总', () => {
  it('统计各层数量与归档数', () => {
    const s = summarizeData(fakeState())
    expect(s.habits).toBe(2)
    expect(s.archivedHabits).toBe(1)
    expect(s.checkIns).toBe(1)
    expect(s.builds).toBe(1)
    expect(s.completedBlueprints).toBe(1)
    expect(s.dayClaims).toBe(1)
    expect(s.repairBricks).toBe(3)
    expect(s.foundationNotes).toBe(1)
    expect(s.reminderLogEntries).toBe(1)
    expect(s.theme).toBe('dark')
    expect(s.languages).toBe('zh')
  })

  it('空状态不抛错，计数为 0', () => {
    const s = summarizeData(fakeState({ habits: [], checkIns: [], builds: [], completedBlueprintIds: [], dayClaims: [], repairBricks: 0, foundationNotes: {}, reminderLog: {} }))
    expect(s.habits).toBe(0)
    expect(s.checkIns).toBe(0)
    expect(s.repairBricks).toBe(0)
  })

  it('能识别当前存储后端（jsdom 下是 localStorage）', () => {
    expect(detectStorageBackend()).toBe('localStorage')
  })
})

describe('diagnostics · 报告文本', () => {
  const summary = summarizeData(fakeState())
  const base = 'BlockHabit Diagnostics'

  it('包含数据体量、帧率、崩溃计数三个区块', () => {
    const text = formatDiagnosticsReport({ base, summary, frames: { frames: 72, durationMs: 1200, fps: 60, worstFrameMs: 21.5 }, crashCount: 2 })
    expect(text).toContain('Data summary (local only)')
    expect(text).toContain('Render sampling')
    expect(text).toContain('60 fps')
    expect(text).toContain('Worst frame: 21.5ms')
    expect(text).toContain('Crash log entries included: 2')
    expect(text).toContain('Habits: 2 (archived 1)')
  })

  it('未采样时明确说明原因，而不是留空', () => {
    const text = formatDiagnosticsReport({ base, summary, frames: null, crashCount: 0 })
    expect(text).toContain('not sampled')
  })

  it('报告是纯文本且声明本地生成（不联网）', () => {
    const text = formatDiagnosticsReport({ base, summary, frames: null, crashCount: 0 })
    expect(text).toContain('BlockHabit Diagnostics')
    expect(text).not.toMatch(/https?:\/\//)
  })
})
