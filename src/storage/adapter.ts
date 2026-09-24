import type { AppState } from '../types'

export const STATE_KEY = 'blockhabit-state'
export const SCHEMA_VERSION = 1

export interface StorageAdapter {
  load(): Promise<AppState | null>
  save(state: AppState): Promise<void>
}

export function isValidState(v: unknown): v is AppState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    s.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(s.habits) &&
    Array.isArray(s.checkIns) &&
    Array.isArray(s.builds) &&
    typeof s.activeBlueprintId === 'string' &&
    Array.isArray(s.completedBlueprintIds) &&
    typeof s.settings === 'object' && s.settings !== null
  )
}

/** 旧存档缺 dayClaims 字段时补默认值 */
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
    },
    dayClaims: Array.isArray(s.dayClaims) ? s.dayClaims : [],
    repairBricks: typeof s.repairBricks === 'number' ? s.repairBricks : 0,
    showcasePlacements: Array.isArray(s.showcasePlacements) ? s.showcasePlacements : [],
    foundationNotes:
      typeof s.foundationNotes === 'object' && s.foundationNotes !== null
        ? s.foundationNotes
        : {},
  }
}

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    async load(): Promise<AppState | null> {
      try {
        const raw = localStorage.getItem(STATE_KEY)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        return isValidState(parsed) ? normalizeState(parsed) : null
      } catch {
        return null
      }
    },
    async save(state: AppState): Promise<void> {
      localStorage.setItem(STATE_KEY, JSON.stringify(state))
    },
  }
}
