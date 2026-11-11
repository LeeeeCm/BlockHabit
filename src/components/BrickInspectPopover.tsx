import type { MicroMood } from '../types'
import { useI18n } from '../i18n'
import { IconMood, IconStar } from './Icons'

/**
 * 积木悬浮读砖气泡（E5 拆分自 BuildScene.tsx）。
 * 纯展示组件：定位由调用方按指针位置算好传入，本组件不持有状态。
 */
export interface BrickInspectInfo {
  index: number
  /** 相对画布左上角的指针位置 */
  x: number
  y: number
  habitName: string
  date: string
  note?: string
  mood?: MicroMood
  starred?: boolean
}

interface Props {
  block: BrickInspectInfo
  /** 画布 CSS 尺寸：用于把气泡夹在可视区内 */
  containerWidth: number
  containerHeight: number
}

export function BrickInspectPopover({ block, containerWidth, containerHeight }: Props) {
  const { t } = useI18n()
  return (
    <div
      className="brick-inspect-popover"
      style={{
        position: 'absolute',
        left: Math.min(containerWidth - 280, Math.max(12, block.x + 14)),
        top: Math.min(containerHeight - 150, Math.max(12, block.y - 36))
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 4
        }}
      >
        <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--ink)' }}>
          {t.reflections.brickInspectTitle(block.index)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {block.starred && (
            <IconStar size={12} filled style={{ color: 'var(--accent)', flexShrink: 0 }} />
          )}
          {block.mood && (
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                padding: '2px 6px',
                borderRadius: 999,
                background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
                color: 'var(--ink)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3
              }}
            >
              <IconMood mood={block.mood} size={11} style={{ flexShrink: 0 }} />
              <span>{t.microMood[block.mood]}</span>
            </span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginBottom: 6 }}>
        {t.reflections.brickInspectFrom(block.habitName, block.date || '—')}
      </div>
      <div
        style={{
          fontSize: 'var(--fs-small)',
          color: 'var(--ink)',
          lineHeight: 1.45,
          fontStyle: block.note ? 'normal' : 'italic',
          opacity: block.note ? 0.95 : 0.6
        }}
      >
        {block.note || t.reflections.brickInspectNoNote}
      </div>
    </div>
  )
}
