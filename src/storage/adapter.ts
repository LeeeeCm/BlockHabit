import type { AppState, DayClaim, DeletedDayClaim } from '../types'

export const STATE_KEY = 'blockhabit-state'
/** localStorage 路径的损坏档备份 key（Tauri 端为 .corrupt-backup 文件） */
export const CORRUPT_BACKUP_KEY = 'blockhabit-state-corrupt-backup'
export const BACKUP_KEY = 'blockhabit-backup-latest'
export const SCHEMA_VERSION = 2

export interface LoadResult {
  state: AppState | null
  /** 存档来自更新版本的应用（合法但当前版本不可读）：应挂起持久化并提示升级 */
  needsUpgrade?: boolean
}

export interface StorageAdapter {
  load(): Promise<LoadResult>
  save(state: AppState): Promise<void>
  /** 覆盖性操作（导入/同步）前自动备份当前数据；未实现则跳过 */
  backup?(state: AppState): Promise<void>
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isParseableDate(v: unknown): boolean {
  return typeof v === 'string' && !Number.isNaN(new Date(v).getTime())
}

function isValidHabitElement(h: unknown): boolean {
  if (!isRecord(h)) return false
  if (typeof h.id !== 'string' || !h.id) return false
  if (typeof h.name !== 'string') return false
  if (!isParseableDate(h.createdAt)) return false
  const f = h.frequency
  if (!isRecord(f)) return false
  if (f.type === 'daily') return true
  if (f.type === 'weekly') return typeof f.times === 'number' && Number.isFinite(f.times) && f.times > 0
  if (f.type === 'custom') {
    return (
      Array.isArray(f.days) &&
      f.days.length > 0 &&
      f.days.every((d) => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7)
    )
  }
  return false
}

function isValidCheckInElement(c: unknown): boolean {
  if (!isRecord(c)) return false
  if (typeof c.id !== 'string' || !c.id) return false
  if (typeof c.habitId !== 'string' || !c.habitId) return false
  if (typeof c.date !== 'string' || !DATE_RE.test(c.date)) return false
  if (!isParseableDate(c.at)) return false
  if (c.value !== undefined && typeof c.value !== 'number') return false
  if (c.actualMinutes !== undefined && typeof c.actualMinutes !== 'number') return false
  return true
}

function isValidBlockElement(b: unknown): boolean {
  if (!isRecord(b)) return false
  if (typeof b.id !== 'string' || !b.id) return false
  if (typeof b.blueprintId !== 'string' || !b.blueprintId) return false
  if (typeof b.index !== 'number' || !Number.isInteger(b.index) || b.index < 0) return false
  if (!isParseableDate(b.placedAt)) return false
  if (typeof b.fromHabitId !== 'string') return false
  if (typeof b.bonus !== 'boolean') return false
  return true
}

function isValidDayClaimElement(c: unknown): boolean {
  return (
    isRecord(c) &&
    typeof c.date === 'string' &&
    DATE_RE.test(c.date) &&
    isParseableDate(c.claimedAt) &&
    typeof c.blockId === 'string'
  )
}

function isValidDeletedDayClaimElement(c: unknown): boolean {
  return isRecord(c) && typeof c.date === 'string' && DATE_RE.test(c.date) && isParseableDate(c.deletedAt)
}

export type ValidateResult =
  | { ok: true; state: AppState }
  | { ok: false; error: string }

/**
 * 严格校验（导入 / 远程同步用）：任一元素非法即整体拒绝。
 * 未来版本（schemaVersion > SCHEMA_VERSION）同样拒绝，由调用方提示升级。
 */
export function validateState(v: unknown): ValidateResult {
  if (!isRecord(v)) return { ok: false, error: 'not-an-object' }
  if (typeof v.schemaVersion !== 'number' || !Number.isInteger(v.schemaVersion) || v.schemaVersion < 1) {
    return { ok: false, error: 'schema-version' }
  }
  if (v.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'schema-version' }
  if (!Array.isArray(v.habits) || !v.habits.every(isValidHabitElement)) return { ok: false, error: 'habits' }
  if (!Array.isArray(v.checkIns) || !v.checkIns.every(isValidCheckInElement)) return { ok: false, error: 'checkIns' }
  if (!Array.isArray(v.builds) || !v.builds.every(isValidBlockElement)) return { ok: false, error: 'builds' }
  if (v.dayClaims !== undefined && (!Array.isArray(v.dayClaims) || !v.dayClaims.every(isValidDayClaimElement))) {
    return { ok: false, error: 'dayClaims' }
  }
  if (
    v.deletedDayClaims !== undefined &&
    (!Array.isArray(v.deletedDayClaims) || !v.deletedDayClaims.every(isValidDeletedDayClaimElement))
  ) {
    return { ok: false, error: 'deletedDayClaims' }
  }
  if (typeof v.activeBlueprintId !== 'string' || !v.activeBlueprintId) return { ok: false, error: 'activeBlueprintId' }
  if (!Array.isArray(v.completedBlueprintIds)) return { ok: false, error: 'completedBlueprintIds' }
  if (!isRecord(v.settings)) return { ok: false, error: 'settings' }
  return { ok: true, state: v as unknown as AppState }
}

/**
 * 宽松清洗（本地加载用）：丢弃非法元素、保留合法部分；顶层结构损坏返回 null。
 */
export function sanitizeState(v: unknown): AppState | null {
  if (!isRecord(v)) return null
  if (typeof v.schemaVersion !== 'number' || !Number.isInteger(v.schemaVersion) || v.schemaVersion < 1) return null
  if (v.schemaVersion > SCHEMA_VERSION) return null
  if (typeof v.activeBlueprintId !== 'string' || !v.activeBlueprintId) return null
  if (!isRecord(v.settings)) return null
  if (!Array.isArray(v.completedBlueprintIds)) return null
  const habits = Array.isArray(v.habits) ? v.habits.filter(isValidHabitElement) : []
  const checkIns = Array.isArray(v.checkIns) ? v.checkIns.filter(isValidCheckInElement) : []
  const builds = Array.isArray(v.builds) ? v.builds.filter(isValidBlockElement) : []
  return normalizeState({ ...(v as object), habits, checkIns, builds } as AppState)
}

/**
 * 版本迁移管线：旧档逐级升到当前版本后清洗。
 * 迁移表按「来源版本」注册；无注册迁移时仅补版本号（字段向后兼容的升级）。
 */

/** v1 → v2：
 * 1. dayClaims: string[] → DayClaim[]（claimedAt 近似为当日正午；blockId/blueprintId 按 placedAt 匹配既有 __day__ 块回填）
 * 2. 补 deletedDayClaims: []
 * 3. checkIns 回填 blueprintId（按 placedBlockId 对应块的蓝图）
 * 4. 丢弃 CheckIn.rewardBlockIndex（v2 已删除该字段）
 */
function migrateV1toV2(s: Record<string, unknown>): Record<string, unknown> {
  const legacyClaims = Array.isArray(s.dayClaims) ? (s.dayClaims as unknown[]) : []
  const builds = Array.isArray(s.builds) ? (s.builds as Record<string, unknown>[]) : []
  const dayBlockByDate = new Map<string, { id: string; blueprintId: string }>()
  const blueprintByBlockId = new Map<string, string>()
  for (const b of builds) {
    if (typeof b.id !== 'string' || typeof b.blueprintId !== 'string') continue
    blueprintByBlockId.set(b.id, b.blueprintId)
    if (b.fromHabitId !== '__day__') continue
    if (typeof b.placedAt !== 'string') continue
    const d = new Date(b.placedAt)
    if (Number.isNaN(d.getTime())) continue
    // 双候选匹配（与 v1 时代 uncheckIn 的启发式一致）：
    // ISO 串的 UTC 日期前缀 + 本地时区日期键，二者都指向同一天的块
    const localKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    for (const key of new Set([b.placedAt.slice(0, 10), localKey])) {
      if (!dayBlockByDate.has(key)) dayBlockByDate.set(key, { id: b.id, blueprintId: b.blueprintId })
    }
  }
  const activeBp = typeof s.activeBlueprintId === 'string' ? s.activeBlueprintId : ''
  const dayClaims: DayClaim[] = legacyClaims
    .filter((c): c is string => typeof c === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c))
    .map((date) => {
      const matched = dayBlockByDate.get(date)
      return {
        date,
        claimedAt: `${date}T12:00:00.000Z`,
        blockId: matched?.id ?? `migrated-${date}`,
        blueprintId: matched?.blueprintId ?? activeBp,
      }
    })
  const checkIns = Array.isArray(s.checkIns)
    ? (s.checkIns as Record<string, unknown>[]).map((c) => {
        if (!c || typeof c !== 'object') return c
        const { rewardBlockIndex: _dropped, ...rest } = c
        const bp =
          typeof rest.placedBlockId === 'string' ? blueprintByBlockId.get(rest.placedBlockId) : undefined
        return bp ? { ...rest, blueprintId: bp } : rest
      })
    : s.checkIns
  const deletedDayClaims: DeletedDayClaim[] = []
  return { ...s, schemaVersion: 2, dayClaims, deletedDayClaims, checkIns }
}

const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  1: migrateV1toV2,
}

export function loadAndMigrate(
  v: unknown,
): { state: AppState } | { state: null; needsUpgrade?: boolean } {
  if (!isRecord(v)) return { state: null }
  let version = typeof v.schemaVersion === 'number' && Number.isInteger(v.schemaVersion) && v.schemaVersion >= 1 ? v.schemaVersion : 1
  if (version > SCHEMA_VERSION) return { state: null, needsUpgrade: true }
  let current: Record<string, unknown> = v
  while (version < SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version]
    if (!migrate) break
    current = migrate(current)
    version++
  }
  const cleaned = sanitizeState({ ...current, schemaVersion: SCHEMA_VERSION })
  return cleaned ? { state: cleaned } : { state: null }
}

/**
 * 导入 / 远程同步前置处理：
 * - v1 旧档（旧客户端推到云端的导出）：先迁移到 v2 再严格校验（先判版本，防止 v1 走 v2 快速通道漏迁移）；
 * - v2 档：严格校验通过后 normalize；
 * - 其余（损坏 / 未来版本）：返回 null。
 */
export function prepareImport(v: unknown): AppState | null {
  if (isRecord(v) && v.schemaVersion === 1) {
    const check = validateState(migrateV1toV2(v))
    if (check.ok) return normalizeState(check.state)
    return null
  }
  const direct = validateState(v)
  if (direct.ok) return normalizeState(direct.state)
  return null
}

/** 旧存档缺字段时补默认值 */
export function normalizeState(s: AppState): AppState {
  const initialLang =
    s.settings?.language === 'en' || s.settings?.language === 'zh'
      ? s.settings.language
      : typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')
        ? 'zh'
        : 'en'
  return {
    ...s,
    settings: {
      theme:
        s.settings?.theme === 'dark' || s.settings?.theme === 'oat' || s.settings?.theme === 'fog'
          ? s.settings.theme
          : 'light',
      language: initialLang,
      enableMiniWidget: Boolean(s.settings?.enableMiniWidget),
      enableAmbientLighting: s.settings?.enableAmbientLighting !== false,
      enableGentleDecay: s.settings?.enableGentleDecay !== false,
      enableEcoProps: s.settings?.enableEcoProps !== false,
      soundMaterial:
        s.settings?.soundMaterial === 'walnut' ||
        s.settings?.soundMaterial === 'crystal' ||
        s.settings?.soundMaterial === 'metal' ||
        s.settings?.soundMaterial === 'mute'
          ? s.settings.soundMaterial
          : 'classic',
      enableGyroscope: Boolean(s.settings?.enableGyroscope),
      enableXRayInspection: Boolean(s.settings?.enableXRayInspection),
      soundMuted: s.settings?.soundMuted === true,
    },
    dayClaims: Array.isArray(s.dayClaims)
      ? (s.dayClaims as unknown[]).flatMap((c) => {
          if (typeof c === 'string' && DATE_RE.test(c)) {
            // 防御性兼容 v1 遗留字符串
            return [{ date: c, claimedAt: `${c}T12:00:00.000Z`, blockId: `migrated-${c}`, blueprintId: '' }]
          }
          return isValidDayClaimElement(c) ? [c as DayClaim] : []
        })
      : [],
    deletedDayClaims: Array.isArray(s.deletedDayClaims)
      ? (s.deletedDayClaims as unknown[]).filter(isValidDeletedDayClaimElement).map((c) => c as DeletedDayClaim)
      : [],
    repairBricks: typeof s.repairBricks === 'number' ? s.repairBricks : 0,
    showcasePlacements: Array.isArray(s.showcasePlacements) ? s.showcasePlacements : [],
    foundationNotes:
      typeof s.foundationNotes === 'object' && s.foundationNotes !== null
        ? s.foundationNotes
        : {},
  }
}

function backupCorruptRaw(raw: string): void {
  try {
    localStorage.setItem(
      CORRUPT_BACKUP_KEY,
      JSON.stringify({ raw, at: new Date().toISOString() }),
    )
  } catch {
    // 备份失败不阻塞启动
  }
}

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    async load(): Promise<LoadResult> {
      try {
        const raw = localStorage.getItem(STATE_KEY)
        if (!raw) return { state: null }
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          backupCorruptRaw(raw)
          return { state: null }
        }
        const migrated = loadAndMigrate(parsed)
        if (migrated.state) return { state: migrated.state }
        // needsUpgrade：来自更新版本应用的合法存档，不能当损坏覆盖
        if (!migrated.needsUpgrade) backupCorruptRaw(raw)
        return { state: null, needsUpgrade: migrated.needsUpgrade }
      } catch {
        return { state: null }
      }
    },
    async save(state: AppState): Promise<void> {
      // 失败直接抛出（配额超限等），由持久化层捕获后上报 UI
      localStorage.setItem(STATE_KEY, JSON.stringify(state))
    },
    async backup(state: AppState): Promise<void> {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(state))
      } catch {
        // 备份失败不阻塞导入
      }
    },
  }
}
