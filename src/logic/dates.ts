/** 本地时区日期工具，日期一律用 YYYY-MM-DD 字符串表示 */

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(d: Date = new Date()): string {
  return dateKey(d)
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** 返回所在周的周一 00:00（周一为一周开始） */
export function weekStart(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const day = (r.getDay() + 6) % 7 // 周一=0 … 周日=6
  r.setDate(r.getDate() - day)
  return r
}

export function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}
