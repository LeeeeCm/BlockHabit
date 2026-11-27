import type { AppState, CheckIn, DayClaim, PlacedBlock } from '../types'
import { blueprints, blueprintOrder } from '../logic/blueprints'
import { findNextAvailablePlacement } from '../logic/showcase'

/**
 * D-20261127-125：桌宠蓝图（pet-cat / pet-bot）下线后的存档迁移。
 *
 * 旧存档里的桌宠积木不能静默丢弃（A6 数据诚实）：把有效积木连同
 * CheckIn / DayClaim 事实一起搬进「当前正在建造的未完成建筑」；
 * 该建筑容量不够时按主线顺序继续填后续未完成建筑。
 *
 * 只在 normalizeState 末尾调用一次；没有宠物外键时原样返回。
 */

export const LEGACY_PET_BLUEPRINT_IDS = ['pet-cat', 'pet-bot'] as const
export type LegacyPetBlueprintId = (typeof LEGACY_PET_BLUEPRINT_IDS)[number]

/** 下线时的旧蓝图容量（与 generatorsV4 的 12 / 16 块一致） */
const LEGACY_PET_CAPACITY: Readonly<Record<LegacyPetBlueprintId, number>> = {
  'pet-cat': 12,
  'pet-bot': 16
}

const LEGACY_PET_ID_SET: ReadonlySet<string> = new Set(LEGACY_PET_BLUEPRINT_IDS)

export function isLegacyPetBlueprintId(value: unknown): value is LegacyPetBlueprintId {
  return typeof value === 'string' && LEGACY_PET_ID_SET.has(value)
}

function hasLegacyPetReferences(state: AppState): boolean {
  if (isLegacyPetBlueprintId(state.activeBlueprintId)) return true
  if ((state.completedBlueprintIds ?? []).some(isLegacyPetBlueprintId)) return true
  if (
    (state.builds ?? []).some((block) => block != null && isLegacyPetBlueprintId(block.blueprintId))
  )
    return true
  if (
    (state.checkIns ?? []).some(
      (checkIn) => checkIn != null && isLegacyPetBlueprintId(checkIn.blueprintId)
    )
  )
    return true
  if (
    (state.dayClaims ?? []).some(
      (claim) => claim != null && isLegacyPetBlueprintId(claim.blueprintId)
    )
  )
    return true
  return (state.showcasePlacements ?? []).some(
    (placement) => placement != null && isLegacyPetBlueprintId(placement.blueprintId)
  )
}

/** 目标蓝图已占用的槽位（墓碑不算；越界/重复 index 只占一个槽） */
function occupiedSlots(
  builds: readonly PlacedBlock[],
  blueprintId: string,
  capacity: number
): Set<number> {
  const slots = new Set<number>()
  for (const block of builds) {
    if (block.blueprintId !== blueprintId || block.deletedAt) continue
    if (!Number.isInteger(block.index) || block.index < 0 || block.index >= capacity) continue
    slots.add(block.index)
  }
  return slots
}

interface PetBlockCandidate {
  id: string
  legacyId: LegacyPetBlueprintId
  placedAt: string
  bonus: boolean
  fromHabitId: string
  /** 该块在旧 builds 里已经投影过（优先于只有事实、尚未投影的块） */
  fromBuild: boolean
}

/**
 * 迁移入口。读取旧存档时由 `normalizeState` 调用：
 * - 旧宠物 id 已通过 KNOWN_BLUEPRINT_IDS 白名单放行，因此不会在 sanitize 阶段丢块；
 * - 迁移完成后，存档中不再出现宠物外键。
 */
export function migrateLegacyPetBlueprints(state: AppState): AppState {
  if (!hasLegacyPetReferences(state)) return state

  const sourceBuilds = (state.builds ?? []).filter((block) => block != null)
  const sourceCheckIns = (state.checkIns ?? []).filter((checkIn) => checkIn != null)
  const sourceDayClaims = (state.dayClaims ?? []).filter((claim) => claim != null)

  // 1. 收集可搬运的宠物积木：优先以用户实际看到的 builds 为准，
  //    同时兜住“事实存在但 builds 尚未投影”的打卡与全勤块。
  const candidates: PetBlockCandidate[] = []
  const seenCandidateIds = new Set<string>(
    sourceBuilds
      .filter((block) => block != null && !isLegacyPetBlueprintId(block.blueprintId))
      .map((block) => block.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  )
  const petSlots = new Map<LegacyPetBlueprintId, Set<number>>()
  const petIds = new Map<LegacyPetBlueprintId, Set<string>>()

  for (const block of sourceBuilds) {
    if (!isLegacyPetBlueprintId(block.blueprintId) || block.deletedAt) continue
    if (typeof block.id !== 'string' || !block.id || seenCandidateIds.has(block.id)) continue
    if (
      !Number.isInteger(block.index) ||
      block.index < 0 ||
      block.index >= LEGACY_PET_CAPACITY[block.blueprintId]
    ) {
      continue
    }
    const slots = petSlots.get(block.blueprintId) ?? new Set<number>()
    const ids = petIds.get(block.blueprintId) ?? new Set<string>()
    if (slots.has(block.index) || ids.has(block.id)) continue
    slots.add(block.index)
    ids.add(block.id)
    petSlots.set(block.blueprintId, slots)
    petIds.set(block.blueprintId, ids)
    seenCandidateIds.add(block.id)
    candidates.push({
      id: block.id,
      legacyId: block.blueprintId,
      placedAt: block.placedAt,
      bonus: block.bonus,
      fromHabitId: block.fromHabitId,
      fromBuild: true
    })
  }

  for (const checkIn of sourceCheckIns) {
    if (!isLegacyPetBlueprintId(checkIn.blueprintId) || checkIn.deletedAt) continue
    const blockId = checkIn.placedBlockId
    if (!blockId || seenCandidateIds.has(blockId)) continue
    seenCandidateIds.add(blockId)
    candidates.push({
      id: blockId,
      legacyId: checkIn.blueprintId,
      placedAt: checkIn.at,
      bonus: checkIn.bonus === true,
      fromHabitId: checkIn.habitId,
      fromBuild: false
    })
  }

  for (const claim of sourceDayClaims) {
    if (!isLegacyPetBlueprintId(claim.blueprintId)) continue
    const blockId = claim.blockId
    if (!blockId || seenCandidateIds.has(blockId)) continue
    seenCandidateIds.add(blockId)
    candidates.push({
      id: blockId,
      legacyId: claim.blueprintId,
      placedAt: claim.claimedAt,
      bonus: true,
      fromHabitId: '__day__',
      fromBuild: false
    })
  }

  // 旧投影每个宠物最多只显示旧容量那么多块。先保证旧 builds 里已经可见的块
  // 不被“只有事实、尚未投影”的块挤掉，再按时间顺序补足剩余名额。
  const sorted = [...candidates].sort(
    (a, b) =>
      Number(b.fromBuild) - Number(a.fromBuild) ||
      a.placedAt.localeCompare(b.placedAt) ||
      a.id.localeCompare(b.id)
  )
  const perPetCount = new Map<LegacyPetBlueprintId, number>()
  const transferable = sorted.filter((candidate) => {
    const count = perPetCount.get(candidate.legacyId) ?? 0
    if (count >= LEGACY_PET_CAPACITY[candidate.legacyId]) return false
    perPetCount.set(candidate.legacyId, count + 1)
    return true
  })
  // 真正落位时仍按时间顺序排，保证迁移块在目标建筑里自然接续。
  transferable.sort((a, b) => a.placedAt.localeCompare(b.placedAt) || a.id.localeCompare(b.id))

  // 2. 目标：当前 active 若未完成就优先它；否则主线第一座未完成建筑。
  const capacityOf = (id: string): number => blueprints[id]?.blocks.length ?? 0
  const occupancy = new Map<string, Set<number>>()
  for (const id of blueprintOrder) {
    occupancy.set(id, occupiedSlots(sourceBuilds, id, capacityOf(id)))
  }
  const isIncomplete = (id: string): boolean => (occupancy.get(id)?.size ?? 0) < capacityOf(id)
  const activeIsMain = blueprintOrder.includes(state.activeBlueprintId)
  const primary =
    activeIsMain && isIncomplete(state.activeBlueprintId)
      ? state.activeBlueprintId
      : blueprintOrder.find(isIncomplete)
  const queue = primary
    ? blueprintOrder.slice(blueprintOrder.indexOf(primary)).filter(isIncomplete)
    : []

  // 3. 逐块放进目标蓝图的第一个空槽；目标满了就顺延到下一座未完成建筑。
  const assignments = new Map<string, { blueprintId: string; index: number }>()
  const affected = new Set<string>()
  let queueIndex = 0
  for (const candidate of transferable) {
    while (queueIndex < queue.length) {
      const target = queue[queueIndex]
      if ((occupancy.get(target)?.size ?? 0) < capacityOf(target)) break
      queueIndex++
    }
    if (queueIndex >= queue.length) break
    const target = queue[queueIndex]
    const slots = occupancy.get(target)!
    let free = 0
    while (slots.has(free)) free++
    slots.add(free)
    assignments.set(candidate.id, { blueprintId: target, index: free })
    affected.add(target)
  }

  // 4. 重写积木行：宠物行换成目标建筑的空槽；只有事实、没有 build 行的块补出投影行，
  //    否则会占掉槽位却不产生可见积木（导致后续 index 冲突/假完成）。墓碑行统一移除。
  const builds: PlacedBlock[] = []
  const emittedBuildIds = new Set<string>()
  for (const block of sourceBuilds) {
    if (block.deletedAt) continue
    if (!isLegacyPetBlueprintId(block.blueprintId)) {
      builds.push(block)
      emittedBuildIds.add(block.id)
      continue
    }
    const assignment = assignments.get(block.id)
    if (!assignment || emittedBuildIds.has(block.id)) continue
    emittedBuildIds.add(block.id)
    builds.push({ ...block, blueprintId: assignment.blueprintId, index: assignment.index })
  }
  for (const candidate of transferable) {
    const assignment = assignments.get(candidate.id)
    if (!assignment || emittedBuildIds.has(candidate.id)) continue
    emittedBuildIds.add(candidate.id)
    builds.push({
      id: candidate.id,
      blueprintId: assignment.blueprintId,
      index: assignment.index,
      placedAt: candidate.placedAt,
      fromHabitId: candidate.fromHabitId,
      bonus: candidate.bonus
    })
  }

  // 5. 事实层同步：有落位的改到目标蓝图；无落位的保留打卡但清掉掉块关联。
  const checkIns = sourceCheckIns.map((checkIn): CheckIn => {
    if (!isLegacyPetBlueprintId(checkIn.blueprintId)) return checkIn
    const assignment = checkIn.placedBlockId ? assignments.get(checkIn.placedBlockId) : undefined
    if (assignment) return { ...checkIn, blueprintId: assignment.blueprintId }
    const { placedBlockId: _placedBlockId, blueprintId: _blueprintId, ...rest } = checkIn
    return rest
  })

  const dayClaims = sourceDayClaims.map((claim): DayClaim => {
    if (!isLegacyPetBlueprintId(claim.blueprintId)) return claim
    const assignment = assignments.get(claim.blockId)
    return assignment
      ? { ...claim, blueprintId: assignment.blueprintId }
      : { ...claim, blueprintId: '' }
  })

  // 6. 完成态与展台：去掉宠物 id；迁移后填满的建筑补登完成并寻找展台空位。
  const completedBlueprintIds = (state.completedBlueprintIds ?? []).filter(
    (id) => !isLegacyPetBlueprintId(id)
  )
  const newlyCompleted: string[] = []
  for (const id of affected) {
    if ((occupancy.get(id)?.size ?? 0) >= capacityOf(id) && !completedBlueprintIds.includes(id)) {
      completedBlueprintIds.push(id)
      newlyCompleted.push(id)
    }
  }
  const showcasePlacements = (state.showcasePlacements ?? []).filter(
    (placement) => placement != null && !isLegacyPetBlueprintId(placement.blueprintId)
  )
  for (const id of newlyCompleted) {
    if (showcasePlacements.some((placement) => placement.blueprintId === id)) continue
    const placement = findNextAvailablePlacement(id, showcasePlacements, blueprints)
    if (placement) showcasePlacements.push(placement)
  }

  // 原 active 是宠物时，迁到「迁移后仍未完成」的第一座目标建筑；
  // 若目标刚好被宠物积木填满，不要留在一座已完成建筑上让后续打卡不掉块。
  const activeBlueprintId = isLegacyPetBlueprintId(state.activeBlueprintId)
    ? (queue.find((id) => (occupancy.get(id)?.size ?? 0) < capacityOf(id)) ??
      primary ??
      blueprintOrder[0])
    : state.activeBlueprintId

  builds.sort(
    (a, b) =>
      a.blueprintId.localeCompare(b.blueprintId) || a.index - b.index || a.id.localeCompare(b.id)
  )

  return {
    ...state,
    builds,
    checkIns,
    dayClaims,
    completedBlueprintIds,
    showcasePlacements,
    activeBlueprintId
  }
}
