import type { BlockDef, Blueprint, CheckIn, MicroMood, PlacedBlock } from '../../types'
import type { CascadePlan } from '../sceneMotion'

/**
 * 建造场景内部共享类型（拆分自 BuildScene.tsx）：
 * 组件持有 ref 与状态，绘制 / 相机 / 展示子模块只依赖这些结构类型。
 */

/** 可变引用容器（React ref 的结构类型，避免依赖 RefObject 泛型细节） */
export interface Ref<T> {
  current: T
}

/** 画家算法排序后的单块：渲染与命中检测的最小条目 */
export interface CubeEntry {
  b: BlockDef
  i: number
  rx: number
  ry: number
}

/** 画布视图：screen = iso 坐标 × scale + pan */
export interface ViewState {
  scale: number
  panX: number
  panY: number
  fitted: boolean
}

/** 单块对应的打卡事实元数据（O(1) 查找，替代每帧循环内双重线性 find） */
export interface BlockMeta {
  pb?: PlacedBlock
  ci?: CheckIn
  habitName?: string
}

/** 由蓝图 / 已放置块数派生的渲染索引（memo 产出，经 ref 供绘制读取） */
export interface DerivedScene {
  cx: number
  cy: number
  sortedCubes: CubeEntry[]
  indexAt: Map<string, number>
  blockMetaByIndex: Map<number, BlockMeta>
}

/** 当前帧的渲染状态（props 经 ref 透传，保证 draw 回调引用稳定） */
export interface SceneState {
  blueprint: Blueprint
  placedCount: number
  animateIndex?: number | null
  rotation: number
  enableAmbient: boolean
  enableGyroscope: boolean
  xrayMode: boolean
}

/** 悬停读砖气泡数据（纯展示，由 BrickInspectPopover 消费） */
export interface HoveredBlock {
  index: number
  x: number
  y: number
  habitName: string
  date: string
  note?: string
  mood?: MicroMood
  starred?: boolean
}

/** 单帧绘制所需的全部 refs 与回调 */
export interface SceneRuntime {
  canvasRef: Ref<HTMLCanvasElement | null>
  stateRef: Ref<SceneState>
  derivedRef: Ref<DerivedScene>
  viewRef: Ref<ViewState>
  gyroOffsetRef: Ref<{ x: number; y: number }>
  animRef: Ref<{ index: number; start: number } | null>
  cascadeRef: Ref<CascadePlan | null>
  rafRef: Ref<number | null>
  cubesRef: Ref<CubeEntry[]>
  hoveredIndexRef: Ref<number | null>
  onAnimatedRef: Ref<(() => void) | undefined>
  /** 稳定的重绘入口：动画帧与同步续帧都经它，保证读到最新 refs */
  redraw: () => void
  /** 挂载首帧的 interactiveInspect（与拆分前 draw 闭包捕获口径一致） */
  interactiveInspect: boolean
}
