import { describe, expect, it } from 'vitest'
import {
  parseHabitFile,
  parseHabitsCsv,
  parseHabitsJson,
  splitImportCandidates
} from './habitImport'

describe('habitImport CSV', () => {
  it('解析 daily / weekly / 时段 / 目标时长 / 备注', () => {
    const csv = [
      'name,frequency,days,times,period,target_minutes,unit,step,note',
      '喝水,daily,,,morning,,,,每天八杯',
      '阅读,weekly,,3,evening,30,,,睡前'
    ].join('\n')
    const result = parseHabitsCsv(csv)
    expect(result.error).toBeUndefined()
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0]).toMatchObject({
      name: '喝水',
      frequency: { type: 'daily' },
      extra: { kind: 'instant', period: 'morning', note: '每天八杯' }
    })
    expect(result.candidates[1]).toMatchObject({
      name: '阅读',
      frequency: { type: 'weekly', times: 3 },
      extra: { kind: 'focus', targetMinutes: 30, period: 'evening' }
    })
  })

  it('custom 星期支持中文逗号，counter 需要 unit', () => {
    const csv = [
      'name,frequency,days,target_value,unit,step',
      '跑步,custom,"1，3，5",,,',
      '喝水,daily,,2000,ml,250'
    ].join('\n')
    const result = parseHabitsCsv(csv)
    expect(result.candidates[0].frequency).toEqual({ type: 'custom', days: [1, 3, 5] })
    expect(result.candidates[1].extra).toMatchObject({
      kind: 'counter',
      targetValue: 2000,
      unit: 'ml',
      step: 250
    })
  })

  it('支持引号字段里的逗号与转义引号', () => {
    const csv = ['name,note', '"读,书","他说""好"""'].join('\n')
    const result = parseHabitsCsv(csv)
    expect(result.candidates[0].name).toBe('读,书')
    expect(result.candidates[0].extra.note).toBe('他说"好"')
  })

  it('跳过空名、无 times 的 weekly、无 days 的 custom 与文件内重名', () => {
    const csv = [
      'name,frequency,days,times',
      ',daily,,',
      '阅读,weekly,,',
      '跑步,custom,,',
      '喝水,daily,,',
      '喝水,daily,,'
    ].join('\n')
    const result = parseHabitsCsv(csv)
    expect(result.candidates.map((c) => c.name)).toEqual(['喝水'])
    expect(result.skipped.map((s) => s.reason)).toEqual([
      'empty-name',
      'bad-times',
      'bad-days',
      'duplicate-in-file'
    ])
  })

  it('缺少 name 列时整体报错', () => {
    expect(parseHabitsCsv('frequency,times\ndaily,1').error).toBe('missing-name-column')
  })
})

describe('habitImport JSON', () => {
  it('接受数组与 { habits }，频率可为字符串或对象', () => {
    const array = parseHabitsJson(
      JSON.stringify([
        { name: '喝水', frequency: 'daily' },
        { name: '阅读', frequency: { type: 'weekly', times: 2 }, targetMinutes: 20 }
      ])
    )
    expect(array.candidates).toHaveLength(2)
    expect(array.candidates[1].frequency).toEqual({ type: 'weekly', times: 2 })
    expect(array.candidates[1].extra).toMatchObject({ kind: 'focus', targetMinutes: 20 })

    const wrapped = parseHabitsJson(
      JSON.stringify({ habits: [{ name: '跑步', frequency: 'custom', days: [2, 4] }] })
    )
    expect(wrapped.candidates[0].frequency).toEqual({ type: 'custom', days: [2, 4] })
  })

  it('语法错误与缺少数组时整体报错', () => {
    expect(parseHabitsJson('{').error).toBe('invalid-json')
    expect(parseHabitsJson('{"foo":1}').error).toBe('missing-habits-array')
  })
})

describe('habitImport 文件与去重', () => {
  it('按扩展名/内容选择 JSON 或 CSV', () => {
    expect(parseHabitFile('habits.json', '{"habits":[]}').error).toBeUndefined()
    const byContent = parseHabitFile('export.txt', '[{"name":"喝水"}]')
    expect(byContent.candidates[0].name).toBe('喝水')
  })

  it('与现有习惯按名称去重（忽略大小写）', () => {
    const result = parseHabitsCsv('name\nRead\n喝水')
    const split = splitImportCandidates(result.candidates, ['read'])
    expect(split.toAdd.map((c) => c.name)).toEqual(['喝水'])
    expect(split.duplicates.map((c) => c.name)).toEqual(['Read'])
  })
})
