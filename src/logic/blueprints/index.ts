import type { Blueprint } from '../../types'
import { makeCastleBlueprint, makeFactoryBlueprint } from './generators'

export const castleBlueprint = makeCastleBlueprint()
export const factoryBlueprint = makeFactoryBlueprint()

export const blueprints: Record<string, Blueprint> = {
  castle: castleBlueprint,
  factory: factoryBlueprint,
}

export function getBlueprint(id: string): Blueprint {
  const bp = blueprints[id]
  if (!bp) throw new Error(`unknown blueprint: ${id}`)
  return bp
}
