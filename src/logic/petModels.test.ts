import { describe, expect, it } from 'vitest'
import type { CheckIn, PlacedBlock } from '../types'
import { defaultState } from '../store/appStoreHelpers'
import { mergeAppState } from '../sync/merge'
import { rebuildBuilds } from './builds'
import { blueprintOrder } from './blueprints'
import { completedCatalogCount, firstIncompleteIndex } from './blueprint'
import { resolvePetModel } from './petModels'

function placed(blueprintId: string, count: number): PlacedBlock[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${blueprintId}-${index}`,
    blueprintId,
    index,
    placedAt: '2026-11-24T12:00:00.000Z',
    fromHabitId: 'habit-1',
    bonus: false
  }))
}

describe('resolvePetModel', () => {
  it('falls back for missing, unknown or malformed choices', () => {
    const cat = placed('pet-cat', 12)
    for (const value of [undefined, null, 'pet-cat', 'toString', 1, { model: 'cat' }]) {
      expect(resolvePetModel(value, cat)).toBe('block')
    }
    expect(resolvePetModel('block', cat)).toBe('block')
  })

  it.each([
    ['cat', 'pet-cat', 12],
    ['bot', 'pet-bot', 16]
  ] as const)('equips %s only when its own blueprint is filled', (model, blueprintId, capacity) => {
    const partial = placed(blueprintId, capacity - 1)
    expect(resolvePetModel(model, [...partial, ...placed('castle', 2)])).toBe('block')
    expect(resolvePetModel(model, placed(blueprintId, capacity))).toBe(model)
  })

  it('does not mistake duplicate, out-of-range, fractional or tombstoned slots for the last block', () => {
    const cat = placed('pet-cat', 12)
    const last = cat[11]
    const invalid = [
      { ...last, index: 0 },
      { ...last, index: 12 },
      { ...last, index: -1 },
      { ...last, index: 11.5 },
      { ...last, deletedAt: '2026-11-24T14:00:00.000Z' },
      { ...last, id: cat[0].id }
    ]
    for (const candidate of invalid) {
      expect(resolvePetModel('cat', [...cat.slice(0, -1), candidate])).toBe('block')
    }
    expect(resolvePetModel('cat', cat.slice(0, -1))).toBe('block')
  })

  it('falls back after a real merge removes the final projected block without erasing the choice', () => {
    const base = defaultState()
    const checkIns: CheckIn[] = placed('pet-cat', 12).map((block) => ({
      id: `check-${block.index}`,
      habitId: `habit-${block.index}`,
      date: '2026-11-24',
      at: block.placedAt,
      placedBlockId: block.id,
      blueprintId: block.blueprintId
    }))
    const local = {
      ...base,
      checkIns,
      builds: rebuildBuilds(checkIns, []),
      completedBlueprintIds: ['pet-cat'],
      settings: { ...base.settings, petModel: 'cat' as const }
    }
    expect(resolvePetModel(local.settings.petModel, local.builds)).toBe('cat')

    const removed = { ...checkIns[11], deletedAt: new Date().toISOString() }
    const merged = mergeAppState(local, { ...base, checkIns: [removed] })
    expect(merged.builds).toHaveLength(11)
    expect(merged.settings.petModel).toBe('cat')
    expect(resolvePetModel(merged.settings.petModel, merged.builds)).toBe('block')
  })
})

describe('installed blueprint completion', () => {
  const bothPets = [...placed('pet-cat', 12), ...placed('pet-bot', 16)]
  const petIds = ['pet-cat', 'pet-bot']

  it('does not replace two missing main builds with two completed pets', () => {
    const completed = [...blueprintOrder.slice(0, -2), ...petIds]
    expect(completedCatalogCount(completed, bothPets)).toBe(23)
    expect(blueprintOrder[firstIncompleteIndex(completed)]).toBe('firestation')
  })

  it('does not claim all installed content is built from main completion or stale pet entries', () => {
    expect(completedCatalogCount([...blueprintOrder, ...petIds], [])).toBe(23)
    expect(completedCatalogCount([...blueprintOrder, 'plant', 'ghost-id'], bothPets)).toBe(25)
    expect(blueprintOrder[firstIncompleteIndex([...blueprintOrder, ...petIds])]).toBeUndefined()
  })
})
