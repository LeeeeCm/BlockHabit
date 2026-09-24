import type { Blueprint } from '../../types'
import {
  makeCabinBlueprint,
  makeCameraBlueprint,
  makeCastleBlueprint,
  makeCoffeeBlueprint,
  makeFactoryBlueprint,
  makeLighthouseBlueprint,
  makeMonumentBlueprint,
  makePlantBlueprint,
  makePyramidBlueprint,
  makeRocketBlueprint,
  makeRobotBlueprint,
  makeWindmillBlueprint,
} from './generators'

export const plantBlueprint = makePlantBlueprint()
export const coffeeBlueprint = makeCoffeeBlueprint()
export const cameraBlueprint = makeCameraBlueprint()
export const windmillBlueprint = makeWindmillBlueprint()
export const cabinBlueprint = makeCabinBlueprint()
export const rocketBlueprint = makeRocketBlueprint()
export const lighthouseBlueprint = makeLighthouseBlueprint()
export const factoryBlueprint = makeFactoryBlueprint()
export const monumentBlueprint = makeMonumentBlueprint()
export const pyramidBlueprint = makePyramidBlueprint()
export const robotBlueprint = makeRobotBlueprint()
export const castleBlueprint = makeCastleBlueprint()
/** 图鉴/解锁顺序（后者必须等前者落成） */
export const blueprintOrder: string[] = [
  'plant',
  'coffee',
  'camera',
  'windmill',
  'cabin',
  'rocket',
  'lighthouse',
  'factory',
  'monument',
  'pyramid',
  'robot',
  'castle',
]

export const blueprints: Record<string, Blueprint> = {
  plant: plantBlueprint,
  coffee: coffeeBlueprint,
  camera: cameraBlueprint,
  windmill: windmillBlueprint,
  cabin: cabinBlueprint,
  rocket: rocketBlueprint,
  lighthouse: lighthouseBlueprint,
  factory: factoryBlueprint,
  monument: monumentBlueprint,
  pyramid: pyramidBlueprint,
  robot: robotBlueprint,
  castle: castleBlueprint,
}

export function getBlueprint(id: string): Blueprint {
  const bp = blueprints[id]
  if (!bp) throw new Error(`unknown blueprint: ${id}`)
  return bp
}
