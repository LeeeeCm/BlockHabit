import type { Blueprint } from '../../types'
import {
  makeBridgeBlueprint,
  makeCabinBlueprint,
  makeCameraBlueprint,
  makeCastleBlueprint,
  makeClocktowerBlueprint,
  makeCoffeeBlueprint,
  makeFactoryBlueprint,
  makeGreenhouseBlueprint,
  makeLibraryBlueprint,
  makeLighthouseBlueprint,
  makeMonumentBlueprint,
  makeObservatoryBlueprint,
  makePlantBlueprint,
  makePyramidBlueprint,
  makeRocketBlueprint,
  makeRobotBlueprint,
  makeTreehouseBlueprint,
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
// 内容包 v2（D-20261110-063）：城市与生活 6 座，一律追加在基础 12 座之后
export const treehouseBlueprint = makeTreehouseBlueprint()
export const greenhouseBlueprint = makeGreenhouseBlueprint()
export const clocktowerBlueprint = makeClocktowerBlueprint()
export const bridgeBlueprint = makeBridgeBlueprint()
export const observatoryBlueprint = makeObservatoryBlueprint()
export const libraryBlueprint = makeLibraryBlueprint()
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
  // 内容包 v2
  'treehouse',
  'greenhouse',
  'clocktower',
  'bridge',
  'observatory',
  'library',
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
  treehouse: treehouseBlueprint,
  greenhouse: greenhouseBlueprint,
  clocktower: clocktowerBlueprint,
  bridge: bridgeBlueprint,
  observatory: observatoryBlueprint,
  library: libraryBlueprint,
}

/**
 * 取蓝图。未知 id 不再抛错：
 * 存档/同步带来的非法外键若在渲染期抛错会整树卸载（白屏），并可能被落盘形成 crash loop。
 * 因此回落第一座蓝图（plant），仅在控制台留一条告警便于定位脏数据。
 */
export function getBlueprint(id: string): Blueprint {
  const bp = blueprints[id]
  if (bp) return bp
  console.warn(`[blueprints] unknown blueprint: ${id}, falling back to ${blueprintOrder[0]}`)
  return blueprints[blueprintOrder[0]]
}
