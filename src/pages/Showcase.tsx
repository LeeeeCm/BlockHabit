import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { blueprints, getBlueprint } from '../logic/blueprints'
import { findNextAvailablePlacement, SHOWCASE_GRID_SIZE } from '../logic/showcase'
import { ShowcaseScene } from '../render/ShowcaseScene'
import { PolaroidModal } from '../components/PolaroidModal'
import { useI18n } from '../i18n'
import { IconBulb, IconSparkle } from '../components/Icons'
import type { ShowcasePlacement } from '../types'
/**
 * 展台沙盘页面：
 * 自由拖拽建筑布局、AABB 无碰撞磁吸落位、点击模型查看拍立得纪念相纸。
 */
export default function Showcase() {
  const { t } = useI18n()
  const showcasePlacements = useAppStore((s) => s.showcasePlacements ?? [])
  const updateShowcasePlacement = useAppStore((s) => s.updateShowcasePlacement)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  function handleAutoArrange() {
    const list = completed.length > 0 ? completed : ['plant']
    const next: ShowcasePlacement[] = []
    for (const id of list) {
      const p = findNextAvailablePlacement(id, next, blueprints, SHOWCASE_GRID_SIZE)
      next.push(p)
    }
    useAppStore.setState({ showcasePlacements: next })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* 顶部标题与陈列统计 */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{t.showcase.title}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconBulb size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>{t.showcase.dragHint}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showcasePlacements.length > 0 && (
            <button
              className="btn ghost"
              onClick={handleAutoArrange}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              title={t.showcase.autoArrange}
            >
              <IconSparkle size={12} style={{ color: 'var(--accent)' }} />
              <span>{t.showcase.autoArrange}</span>
            </button>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: '3px 12px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span style={{ color: 'var(--progress-green)' }}>●</span>
            <span>{t.showcase.countDisplay(showcasePlacements.length)}</span>
          </div>
        </div>
      </div>

      {/* 2.5D 展台沙盘画布 */}
      <div style={{ flex: 1, position: 'relative', background: 'var(--bg)' }}>
        <ShowcaseScene
          placements={showcasePlacements}
          blueprintsMap={blueprints}
          onUpdatePlacement={updateShowcasePlacement}
          onSelectModel={(id) => setSelectedBlueprintId(id)}
        />

        {showcasePlacements.length === 0 && (
          <div
            style={{
              position: 'absolute',
              left: 24,
              bottom: 24,
              padding: '12px 18px',
              background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line)',
              fontSize: 13,
              color: 'var(--ink-2)',
              lineHeight: 1.6,
            }}
          >
            {t.showcase.emptyHint}
          </div>
        )}
      </div>

      {/* 点击模型打开拍立得纪念卡 */}
      {selectedBlueprintId && (
        <PolaroidModal
          blueprint={getBlueprint(selectedBlueprintId)}
          onClose={() => setSelectedBlueprintId(null)}
        />
      )}
    </div>
  )
}
