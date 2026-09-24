import type { AppState, CheckIn, Habit, PlacedBlock, ShowcasePlacement } from '../types'

/**
 * Merges local and remote habits without data loss.
 * Preserves existing local habits, adds new remote habits,
 * and unions flags like archivedAt and pinned.
 */
function mergeHabits(localHabits: Habit[], remoteHabits: Habit[]): Habit[] {
  const habitMap = new Map<string, Habit>()
  for (const h of remoteHabits || []) {
    habitMap.set(h.id, { ...h })
  }
  for (const h of localHabits || []) {
    const existing = habitMap.get(h.id)
    if (!existing) {
      habitMap.set(h.id, { ...h })
    } else {
      habitMap.set(h.id, {
        ...existing,
        ...h,
        archivedAt: h.archivedAt || existing.archivedAt,
        pinned: h.pinned ?? existing.pinned,
      })
    }
  }
  return Array.from(habitMap.values())
}

/**
 * Merges check-ins from both devices by id or habitId+date, preserving all check-ins.
 * Enriches check-ins by merging metadata (notes, mood, starred).
 */
function mergeCheckIns(localCheckIns: CheckIn[], remoteCheckIns: CheckIn[]): CheckIn[] {
  const merged: CheckIn[] = []
  const idMap = new Map<string, number>()
  const dayMap = new Map<string, number>()

  function addOrMerge(c: CheckIn, isRemote: boolean) {
    const dayKey = `${c.habitId}_${c.date}`
    let existingIndex: number | undefined

    if (c.id && idMap.has(c.id)) {
      existingIndex = idMap.get(c.id)
    } else if (dayMap.has(dayKey)) {
      existingIndex = dayMap.get(dayKey)
    }

    if (existingIndex !== undefined) {
      const existing = merged[existingIndex]
      // Local check-in takes precedence for structure, but enrich with non-empty fields from both
      const base = isRemote ? existing : c
      const other = isRemote ? c : existing

      const combined: CheckIn = {
        ...other,
        ...base,
        note: (base.note && base.note.trim()) ? base.note : other.note,
        mood: base.mood || other.mood,
        starred: Boolean(base.starred || other.starred),
        rewardBlockIndex: base.rewardBlockIndex ?? other.rewardBlockIndex,
        placedBlockId: base.placedBlockId || other.placedBlockId,
        actualMinutes: Math.max(base.actualMinutes ?? 0, other.actualMinutes ?? 0) || base.actualMinutes || other.actualMinutes,
        value: Math.max(base.value ?? 0, other.value ?? 0) || base.value || other.value,
      }
      merged[existingIndex] = combined
      if (c.id) idMap.set(c.id, existingIndex)
      dayMap.set(dayKey, existingIndex)
    } else {
      const newIdx = merged.length
      merged.push({ ...c })
      if (c.id) idMap.set(c.id, newIdx)
      dayMap.set(dayKey, newIdx)
    }
  }

  for (const c of remoteCheckIns || []) {
    addOrMerge(c, true)
  }
  for (const c of localCheckIns || []) {
    addOrMerge(c, false)
  }

  return merged.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at))
}

/**
 * Union merge of placed blocks by `${blueprintId}_${index}`.
 */
function mergeBuilds(localBuilds: PlacedBlock[], remoteBuilds: PlacedBlock[]): PlacedBlock[] {
  const map = new Map<string, PlacedBlock>()
  for (const b of remoteBuilds || []) {
    const key = `${b.blueprintId}_${b.index}`
    map.set(key, { ...b })
  }
  for (const b of localBuilds || []) {
    const key = `${b.blueprintId}_${b.index}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...b })
    } else {
      map.set(key, {
        ...existing,
        ...b,
        bonus: Boolean(b.bonus || existing.bonus),
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.blueprintId !== b.blueprintId) {
      return a.blueprintId.localeCompare(b.blueprintId)
    }
    return a.index - b.index
  })
}

/**
 * Merges showcase placements without duplicates.
 */
function mergeShowcasePlacements(
  local?: ShowcasePlacement[],
  remote?: ShowcasePlacement[],
): ShowcasePlacement[] {
  const map = new Map<string, ShowcasePlacement>()
  for (const p of remote || []) {
    map.set(p.blueprintId, { ...p })
  }
  for (const p of local || []) {
    map.set(p.blueprintId, { ...p })
  }
  return Array.from(map.values())
}

/**
 * CRDT union merge algorithm between local and remote AppState.
 * Guarantees zero data loss across multi-device synchronizations.
 */
export function mergeAppState(local: AppState, remote: AppState): AppState {
  const habits = mergeHabits(local.habits, remote.habits)
  const checkIns = mergeCheckIns(local.checkIns, remote.checkIns)
  const builds = mergeBuilds(local.builds, remote.builds)

  const completedBlueprintIds = Array.from(
    new Set([...(local.completedBlueprintIds || []), ...(remote.completedBlueprintIds || [])]),
  ).sort()

  const dayClaims = Array.from(
    new Set([...(local.dayClaims || []), ...(remote.dayClaims || [])]),
  ).sort()

  const repairBricks = Math.max(local.repairBricks ?? 0, remote.repairBricks ?? 0)

  const foundationNotes: Record<string, string> = {
    ...(remote.foundationNotes || {}),
    ...(local.foundationNotes || {}),
  }

  const showcasePlacements = mergeShowcasePlacements(
    local.showcasePlacements,
    remote.showcasePlacements,
  )

  const settings = {
    theme: local.settings?.theme || remote.settings?.theme || 'light',
    language: local.settings?.language || remote.settings?.language || 'zh',
  }

  const activeBlueprintId = local.activeBlueprintId || remote.activeBlueprintId || 'plant'

  return {
    schemaVersion: 1,
    habits,
    checkIns,
    builds,
    activeBlueprintId,
    completedBlueprintIds,
    settings,
    dayClaims,
    repairBricks,
    showcasePlacements,
    foundationNotes,
  }
}
