import type { MouseEventHandler, TouchEventHandler } from 'react'
import { BrickInspectPopover } from '../../components/BrickInspectPopover'
import type { HoveredBlock, Ref } from './sceneTypes'

interface Props {
  /** 画布 ref：尺寸基准与气泡定位都取自同一元素 */
  canvasRef: Ref<HTMLCanvasElement | null>
  /** 当前悬停/轻点中的积木（null = 不显示气泡） */
  hoveredBlock: HoveredBlock | null
  /** 是否开启读砖探针（与悬停数据共同决定气泡可见性） */
  interactiveInspect: boolean
  onTouchStart: TouchEventHandler<HTMLCanvasElement>
  onTouchMove: TouchEventHandler<HTMLCanvasElement>
  onTouchEnd: TouchEventHandler<HTMLCanvasElement>
  onTouchCancel: TouchEventHandler<HTMLCanvasElement>
  onDoubleClick?: MouseEventHandler<HTMLCanvasElement>
}

/**
 * 建造场景舞台（E5 拆分自 BuildScene.tsx）：画布 + 悬停读砖气泡。
 * 纯展示组件，不持状态、不做取景计算；事件回调解由 BuildScene 编排。
 */
export function SceneStage({
  canvasRef,
  hoveredBlock,
  interactiveInspect,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onDoubleClick
}: Props) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onDoubleClick={onDoubleClick}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />
      {hoveredBlock && interactiveInspect && (
        <BrickInspectPopover
          block={hoveredBlock}
          containerWidth={canvasRef.current?.clientWidth ?? 400}
          containerHeight={canvasRef.current?.clientHeight ?? 400}
        />
      )}
    </div>
  )
}
