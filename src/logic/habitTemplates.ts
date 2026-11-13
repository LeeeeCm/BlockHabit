/**
 * 首启模板（D-20261110-053）：把「第一次建习惯」从一次表单填写降为一次点击。
 * 模板只提供名称键、频率与时段；名称本体在 i18n（templates 组），
 * 这里保持纯数据，方便单测与后续扩展。
 */
import type { Habit, HabitPeriod } from '../types'

export type HabitTemplateId = 'water' | 'read' | 'walk' | 'sleep' | 'ledger'

export interface HabitTemplate {
  id: HabitTemplateId
  period: HabitPeriod
}

export const habitTemplates: HabitTemplate[] = [
  { id: 'water', period: 'any' },
  { id: 'read', period: 'evening' },
  { id: 'walk', period: 'any' },
  { id: 'sleep', period: 'evening' },
  { id: 'ledger', period: 'evening' }
]

/** 模板统一用最简频率：每日、瞬时打卡；用户点完可随时编辑 */
export function templateFrequency(): Habit['frequency'] {
  return { type: 'daily' }
}
