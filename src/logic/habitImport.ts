import type { HabitExtra, HabitFrequency, HabitPeriod } from '../types'

/**
 * 从其他应用导入习惯定义（D-20261124-085）。
 *
 * 只导入「习惯」，不导入历史打卡：历史记录会牵动积木、连击与全勤，
 * 必须走完整的 JSON 备份导入，不能在这里静默补建。
 *
 * CSV 表头：name,frequency,days,times,period,target_minutes,target_value,unit,step,note,category,pinned
 * JSON：`HabitInput[]` 或 `{ habits: HabitInput[] }`；字段同 CSV，frequency 可为字符串或对象。
 */

export interface HabitImportCandidate {
  name: string
  frequency: HabitFrequency
  extra: HabitExtra
}

export type HabitImportSkipReason =
  'empty-name' | 'bad-frequency' | 'bad-days' | 'bad-times' | 'duplicate-in-file'

export interface HabitImportSkipped {
  row: number
  name: string
  reason: HabitImportSkipReason
}

export interface HabitImportParseResult {
  candidates: HabitImportCandidate[]
  skipped: HabitImportSkipped[]
  /** 整体解析失败（JSON 语法错误 / 缺少 name 列等） */
  error?: string
}

type RawHabit = Record<string, unknown>

const FREQUENCY_ALIASES: Record<string, 'daily' | 'weekly' | 'custom'> = {
  daily: 'daily',
  day: 'daily',
  every_day: 'daily',
  每天: 'daily',
  每日: 'daily',
  weekly: 'weekly',
  week: 'weekly',
  每周: 'weekly',
  custom: 'custom',
  自定义: 'custom',
  指定星期: 'custom'
}

const PERIOD_ALIASES: Record<string, HabitPeriod> = {
  any: 'any',
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  上午: 'morning',
  下午: 'afternoon',
  晚上: 'evening',
  任何: 'any'
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', 'habit', 'title', '习惯', '名称'],
  frequency: ['frequency', 'repeat', 'freq', '频率'],
  days: ['days', 'weekdays', '星期'],
  times: ['times', 'per_week', 'perweek', 'weekly_times', '次数'],
  period: ['period', 'time_of_day', '时段'],
  targetMinutes: ['target_minutes', 'minutes', 'duration', '目标分钟'],
  targetValue: ['target_value', 'goal', '目标值'],
  unit: ['unit', '单位'],
  step: ['step', '步进'],
  note: ['note', 'notes', '备注'],
  category: ['category', '分类'],
  pinned: ['pinned', '置顶']
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function headerField(header: string): string | null {
  const key = normalizeKey(header)
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((alias) => normalizeKey(alias) === key)) return field
  }
  return null
}

/** 极简 CSV 行解析：支持双引号包裹、逗号与 `""` 转义、字段内换行 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  row.push(field)
  if (row.length > 1 || row[0].trim() !== '') rows.push(row)
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function parseDays(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    const days = value
      .map((v) => toInt(v))
      .filter((v): v is number => v !== null && v >= 1 && v <= 7)
    return days.length > 0 ? Array.from(new Set(days)).sort((a, b) => a - b) : null
  }
  if (typeof value !== 'string') return null
  const parts = value.split(/[,，;；/、\s]+/).filter(Boolean)
  if (parts.length === 0) return null
  const days = parts.map((p) => toInt(p)).filter((v): v is number => v !== null && v >= 1 && v <= 7)
  if (days.length !== parts.length) return null
  return Array.from(new Set(days)).sort((a, b) => a - b)
}

function normalizeFrequency(raw: RawHabit): HabitFrequency | null {
  const freqRaw = raw.frequency
  let type: 'daily' | 'weekly' | 'custom' = 'daily'
  let times: unknown = raw.times
  let days: unknown = raw.days

  if (typeof freqRaw === 'string' && freqRaw.trim()) {
    const mapped = FREQUENCY_ALIASES[normalizeKey(freqRaw)]
    if (!mapped) return null
    type = mapped
  } else if (freqRaw && typeof freqRaw === 'object') {
    const obj = freqRaw as RawHabit
    const typeRaw = obj.type
    if (typeof typeRaw === 'string') {
      const mapped = FREQUENCY_ALIASES[normalizeKey(typeRaw)]
      if (!mapped) return null
      type = mapped
    }
    if (obj.times !== undefined) times = obj.times
    if (obj.days !== undefined) days = obj.days
  }

  if (type === 'daily') return { type: 'daily' }
  if (type === 'weekly') {
    const n = toInt(times)
    if (n === null || n < 1 || n > 7) return null
    return { type: 'weekly', times: n }
  }
  const parsed = parseDays(days)
  if (!parsed) return null
  return { type: 'custom', days: parsed }
}

function buildCandidate(
  raw: RawHabit,
  row: number,
  seen: Set<string>
): { candidate?: HabitImportCandidate; skipped?: HabitImportSkipped } {
  const name = String(raw.name ?? '').trim()
  if (!name) return { skipped: { row, name: '', reason: 'empty-name' } }

  const key = name.toLowerCase()
  if (seen.has(key)) return { skipped: { row, name, reason: 'duplicate-in-file' } }

  let frequency: HabitFrequency | null = null
  let reason: HabitImportSkipReason = 'bad-frequency'
  try {
    frequency = normalizeFrequency(raw)
  } catch {
    frequency = null
  }
  if (!frequency) {
    const freqRaw = raw.frequency
    const isWeekly =
      typeof freqRaw === 'string' && FREQUENCY_ALIASES[normalizeKey(freqRaw)] === 'weekly'
    const isCustom =
      typeof freqRaw === 'string' && FREQUENCY_ALIASES[normalizeKey(freqRaw)] === 'custom'
    reason = isWeekly ? 'bad-times' : isCustom ? 'bad-days' : 'bad-frequency'
    return { skipped: { row, name, reason } }
  }

  const extra: HabitExtra = {}
  const periodRaw = typeof raw.period === 'string' ? raw.period : ''
  const period = periodRaw ? PERIOD_ALIASES[normalizeKey(periodRaw)] : undefined
  if (period) extra.period = period

  const targetMinutes = toInt(raw.targetMinutes)
  const targetValue = toInt(raw.targetValue)
  const step = toInt(raw.step)
  const unit = typeof raw.unit === 'string' ? raw.unit.trim() : ''

  if (targetValue !== null && targetValue > 0 && unit) {
    extra.kind = 'counter'
    extra.targetValue = targetValue
    extra.unit = unit
    if (step !== null && step > 0) extra.step = step
  } else if (targetMinutes !== null && targetMinutes > 0) {
    extra.kind = 'focus'
    extra.targetMinutes = targetMinutes
  } else {
    extra.kind = 'instant'
  }

  const note = typeof raw.note === 'string' ? raw.note.trim() : ''
  if (note) extra.note = note
  const category = typeof raw.category === 'string' ? raw.category.trim() : ''
  if (category) extra.category = category
  if (raw.pinned === true || raw.pinned === 'true' || raw.pinned === '1') extra.pinned = true

  seen.add(key)
  return { candidate: { name, frequency, extra } }
}

export function parseHabitsCsv(text: string): HabitImportParseResult {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return { candidates: [], skipped: [], error: 'empty' }
  const headers = rows[0].map((h) => headerField(h))
  if (!headers.includes('name'))
    return { candidates: [], skipped: [], error: 'missing-name-column' }

  const candidates: HabitImportCandidate[] = []
  const skipped: HabitImportSkipped[] = []
  const seen = new Set<string>()
  for (let r = 1; r < rows.length; r++) {
    const raw: RawHabit = {}
    headers.forEach((field, index) => {
      if (field) raw[field] = rows[r][index] ?? ''
    })
    const result = buildCandidate(raw, r + 1, seen)
    if (result.candidate) candidates.push(result.candidate)
    if (result.skipped) skipped.push(result.skipped)
  }
  return { candidates, skipped }
}

export function parseHabitsJson(text: string): HabitImportParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { candidates: [], skipped: [], error: 'invalid-json' }
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as RawHabit).habits)
      ? ((parsed as RawHabit).habits as unknown[])
      : null
  if (!list) return { candidates: [], skipped: [], error: 'missing-habits-array' }

  const candidates: HabitImportCandidate[] = []
  const skipped: HabitImportSkipped[] = []
  const seen = new Set<string>()
  list.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      skipped.push({ row: index + 1, name: '', reason: 'empty-name' })
      return
    }
    const raw = item as RawHabit
    // JSON 支持 camelCase 与 CSV 的 snake_case
    const normalized: RawHabit = {
      name: raw.name,
      frequency: raw.frequency,
      days: raw.days,
      times: raw.times,
      period: raw.period,
      targetMinutes: raw.targetMinutes ?? raw.target_minutes,
      targetValue: raw.targetValue ?? raw.target_value,
      unit: raw.unit,
      step: raw.step,
      note: raw.note,
      category: raw.category,
      pinned: raw.pinned
    }
    const result = buildCandidate(normalized, index + 1, seen)
    if (result.candidate) candidates.push(result.candidate)
    if (result.skipped) skipped.push(result.skipped)
  })
  return { candidates, skipped }
}

export function parseHabitFile(fileName: string, text: string): HabitImportParseResult {
  const lower = fileName.toLowerCase()
  const trimmed = text.trim()
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.jsonc') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[')
  ) {
    return parseHabitsJson(trimmed)
  }
  return parseHabitsCsv(text)
}

/** 与现有习惯（含已归档）按名称去重；返回可导入与重复两批 */
export function splitImportCandidates(
  candidates: HabitImportCandidate[],
  existingNames: string[]
): { toAdd: HabitImportCandidate[]; duplicates: HabitImportCandidate[] } {
  const existing = new Set(existingNames.map((name) => name.trim().toLowerCase()))
  const toAdd: HabitImportCandidate[] = []
  const duplicates: HabitImportCandidate[] = []
  for (const candidate of candidates) {
    if (existing.has(candidate.name.toLowerCase())) duplicates.push(candidate)
    else toAdd.push(candidate)
  }
  return { toAdd, duplicates }
}
