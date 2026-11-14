import type { Blueprint } from '../../types'
import { BuildScene } from '../../render/BuildScene'

const STAGE_STYLE = {
  flex: 1,
  position: 'relative' as const,
  minHeight: 0,
  background: 'var(--surface)'
}

interface MiniStageProps {
  blueprint: Blueprint
  placedCount: number
  /** 需要播放掉落动画的块序号（新块） */
  animateIndex: number | null
}

/** 3D 迷你积木展示区（日常与专注态共用） */
export function MiniStage({ blueprint, placedCount, animateIndex }: MiniStageProps) {
  return (
    <div style={STAGE_STYLE}>
      <BuildScene blueprint={blueprint} placedCount={placedCount} animateIndex={animateIndex} />
    </div>
  )
}
