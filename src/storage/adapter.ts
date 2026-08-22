import type { AppState } from '../types'

export const STATE_KEY = 'blockhabit-state'
export const SCHEMA_VERSION = 1

export interface StorageAdapter {
  load(): Promise<AppState | null>
  save(state: AppState): Promise<void>
}

function isValidState(v: unknown): v is AppState {
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

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    async load(): Promise<AppState | null> {
      try {
        const raw = localStorage.getItem(STATE_KEY)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        return isValidState(parsed) ? parsed : null
      } catch {
        return null
      }
    },
    async save(state: AppState): Promise<void> {
      localStorage.setItem(STATE_KEY, JSON.stringify(state))
    },
  }
}
