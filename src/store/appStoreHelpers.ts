import type { AppState, Language, PlacedBlock } from '../types'
import { getBlueprint } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'
import { DEFAULT_SANDBOX_ID, createShowcaseSandbox } from '../logic/showcase'

/**
 * appStore 的纯 helper（不依赖 store 实例）：id 生成、蓝图完成态对账、默认状态。
 */
export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * 对账受影响蓝图的完成状态：重建后块数不足者退回未完成。
 * 返回被移除的蓝图 id 集合，调用方据此清理所有沙盘上的落位（D-20261127-127）。
 */
export function reconcileCompletion(
  affectedBpIds: Set<string>,
  nextBuilds: PlacedBlock[],
  completedBlueprintIds: string[]
): { completed: string[]; removed: Set<string> } {
  let completed = completedBlueprintIds
  const removed = new Set<string>()
  for (const bpId of affectedBpIds) {
    if (!completed.includes(bpId)) continue
    const bp = getBlueprint(bpId)
    const count = nextBuilds.filter((b) => b.blueprintId === bpId).length
    if (count < bp.blocks.length) {
      completed = completed.filter((x) => x !== bpId)
      removed.add(bpId)
    }
  }
  return { completed, removed }
}

export function defaultState(): AppState {
  const initialLang: Language =
    typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en'
  return {
    schemaVersion: 2,
    contentVersion: CONTENT_VERSION,
    habits: [],
    checkIns: [],
    builds: [],
    activeBlueprintId: 'plant',
    completedBlueprintIds: [],
    settings: {
      theme: 'light',
      language: initialLang,
      enableAmbientLighting: true,
      enableGentleDecay: true,
      soundMaterial: 'classic',
      soundMuted: false,
      remindersEnabled: true,
      volume: 100,
      eveningNudgeEnabled: false,
      eveningNudgeTime: '21:00',
      quickCheckInEnabled: false,
      enablePet: true,
      petSize: 'medium',
      petRoam: true,
      enableGyroscope: false,
      enableXRayInspection: false
    },
    dayClaims: [],
    deletedDayClaims: [],
    deletedHabits: [],
    repairBricks: 0,
    showcasePlacements: [],
    showcaseSandboxes: [createShowcaseSandbox(DEFAULT_SANDBOX_ID, 0)],
    activeSandboxId: DEFAULT_SANDBOX_ID,
    foundationNotes: {},
    reminderLog: {}
  }
}
