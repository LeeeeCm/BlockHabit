import type { PetModel, PlacedBlock } from '../types'
import { blueprintProgress } from './blueprint'
import type { PET_BLUEPRINT_IDS } from './blueprints'

export const DEFAULT_PET_MODEL: PetModel = 'block'
export const PET_MODELS = ['block', 'cat', 'bot'] as const satisfies readonly PetModel[]
type PetBlueprintId = (typeof PET_BLUEPRINT_IDS)[number]
const PET_BLUEPRINT_BY_MODEL: Record<Exclude<PetModel, 'block'>, PetBlueprintId> = {
  cat: 'pet-cat',
  bot: 'pet-bot'
}

export function petBlueprintId(model: PetModel): PetBlueprintId | undefined {
  return model === 'block' ? undefined : PET_BLUEPRINT_BY_MODEL[model]
}

/** 仅规范化用户选择，不把资格或当前显示状态持久化。 */
export function normalizePetModel(value: unknown): PetModel {
  return value === 'cat' || value === 'bot' ? value : DEFAULT_PET_MODEL
}

/** 撤销或同步导致蓝图未完成时回退；不覆盖用户先前选的形象。 */
export function resolvePetModel(value: unknown, builds: readonly PlacedBlock[]): PetModel {
  const choice = normalizePetModel(value)
  const blueprintId = petBlueprintId(choice)
  return !blueprintId || blueprintProgress(builds, blueprintId).complete
    ? choice
    : DEFAULT_PET_MODEL
}
