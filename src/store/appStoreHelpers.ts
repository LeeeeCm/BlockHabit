import type { AppState, Language, PlacedBlock, ShowcasePlacement } from '../types'
import { getBlueprint } from '../logic/blueprints'
import { CONTENT_VERSION } from '../logic/blueprints/manifest'

/**
 * appStore 的纯 helper（不依赖 store 实例）：id 生成、蓝图完成态对账、默认状态。
 */
export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** 对账受影响蓝图的完成状态：重建后块数不足者退回未完成，并同步移出展台 */
export function reconcileCompletion(
  affectedBpIds: Set<string>,
  nextBuilds: PlacedBlock[],
  completedBlueprintIds: string[],
  showcase: ShowcasePlacement[]
): { completed: string[]; showcase: ShowcasePlacement[] } {
  let completed = completedBlueprintIds
  let nextShowcase = showcase
  for (const bpId of affectedBpIds) {
    if (!completed.includes(bpId)) continue
    const bp = getBlueprint(bpId)
    const count = nextBuilds.filter((b) => b.blueprintId === bpId).length
    if (count < bp.blocks.length) {
      completed = completed.filter((x) => x !== bpId)
      nextShowcase = nextShowcase.filter((p) => p.blueprintId !== bpId)
    }
  }
  return { completed, showcase: nextShowcase }
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
      enableEcoProps: true,
      soundMaterial: 'classic',
      soundMuted: false,
      remindersEnabled: true,
      volume: 100,
      eveningNudgeEnabled: false,
      eveningNudgeTime: '21:00',
      quickCheckInEnabled: false,
      enableGyroscope: false,
      enableXRayInspection: false
    },
    dayClaims: [],
    deletedDayClaims: [],
    repairBricks: 0,
    showcasePlacements: [],
    foundationNotes: {},
    reminderLog: {}
  }
}
