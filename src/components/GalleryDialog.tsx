import { useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { blueprintOrder, getBlueprint } from '../logic/blueprints'
import { canSelectBlueprint } from '../logic/blueprint'
import { getBlueprintName, useI18n } from '../i18n'
import { IconClose, IconNote } from './Icons'
import { BlueprintThumb } from './BlueprintThumb'
import { BuildingArchiveModal } from './BuildingArchiveModal'
import { triggerHaptic } from '../platform'
import { useDialogA11y } from './useDialogA11y'
/** 模型图鉴：按顺序解锁，前一座未落成时后一座不可选 */
export function GalleryDialog({ onClose }: { onClose: () => void }) {
  const { lang, t } = useI18n()
  const builds = useAppStore((s) => s.builds)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const activeId = useAppStore((s) => s.activeBlueprintId)
  const choose = useAppStore((s) => s.chooseBlueprint)
  const [toast, showToast] = useTransient<string>(2200)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  // 档案卡叠在图鉴之上：档案打开时让出 Esc/焦点，避免一次 Esc 连关两层
  const { ref: dialogRef } = useDialogA11y({ open: true, onClose, enabled: archiveId === null })

  function handleSelect(id: string) {
    if (!canSelectBlueprint(id, completed)) {
      showToast(t.gallery.completePreviousFirst, 2200)
      return
    }
    choose(id)
    onClose()
  }

  return (
    <>
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="gallery-dialog-title"
        aria-modal="true"
        tabIndex={-1}
        className="overlay"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="dialog"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ width: 500, maxWidth: '92vw' }}
        >
          <div className="dialog-header">
            <h3 id="gallery-dialog-title">
              {t.gallery.title} · {blueprintOrder.length}
            </h3>
            <button
              className="icon-btn"
              onClick={() => {
                triggerHaptic('light')
                onClose()
              }}
              title={t.common.close}
            >
              <IconClose size={18} />
            </button>
          </div>

          <div className="dialog-body">
            <div className="gallery-grid">
              {blueprintOrder.map((id) => {
                const bp = getBlueprint(id)
                const placed = builds.filter((b) => b.blueprintId === id).length
                const done = completed.includes(id)
                const building = id === activeId && !done
                const unlocked = canSelectBlueprint(id, completed)
                const locked = !unlocked
                const bpName = getBlueprintName(id, lang)
                const status = done
                  ? {
                      label: `${t.gallery.completed} · ${t.build.blocksCount(bp.blocks.length, bp.blocks.length)}`,
                      color: 'var(--progress-green)'
                    }
                  : building
                    ? {
                        label: `${t.gallery.inProgress} · ${placed}/${bp.blocks.length}`,
                        color: 'var(--progress-blue)'
                      }
                    : unlocked
                      ? {
                          label: `${t.build.startBuildBtn} · ${t.gallery.totalBlocks(bp.blocks.length)}`,
                          color: 'var(--ink-2)'
                        }
                      : { label: t.gallery.locked, color: 'var(--ink-2)' }
                return (
                  <div key={id} style={{ position: 'relative', minWidth: 0, display: 'flex' }}>
                    <button
                      className={`gallery-card${locked ? ' locked' : ''}`}
                      onClick={() => handleSelect(id)}
                      title={unlocked ? bpName : t.gallery.completePreviousFirst}
                      aria-disabled={locked}
                      style={{
                        width: '100%',
                        paddingBottom: done ? 34 : undefined,
                        // .gallery-card.locked 的 opacity:.5 会把「名字」也压暗；
                        // B1：锁定信息由剪影表达，名字必须保持可读（inline 覆盖 CSS 类）。
                        opacity: locked ? 1 : undefined
                      }}
                    >
                      <BlueprintThumb blueprint={bp} silhouette={locked} />
                      <div className="gallery-name">{bpName}</div>
                      <div className="gallery-status" style={{ color: status.color }}>
                        {status.label}
                      </div>
                    </button>
                    {done && (
                      <button
                        type="button"
                        className="pill-action"
                        onClick={() => {
                          triggerHaptic('selection')
                          setArchiveId(id)
                        }}
                        title={`${bpName} · ${t.buildingArchive.title}`}
                        aria-label={`${bpName} · ${t.buildingArchive.title}`}
                        style={{
                          position: 'absolute',
                          right: 8,
                          bottom: 8,
                          padding: '3px 9px',
                          fontSize: 'var(--fs-caption)',
                          gap: 4
                        }}
                      >
                        <IconNote size={11} style={{ flexShrink: 0 }} />
                        <span>{t.buildingArchive.entry}</span>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="dialog-footer">
            <button className="btn primary" onClick={onClose} style={{ padding: '7px 24px' }}>
              {t.common.close}
            </button>
          </div>

          {toast && <div className="toast">{toast}</div>}
        </div>
      </div>

      {archiveId && (
        <BuildingArchiveModal blueprintId={archiveId} onClose={() => setArchiveId(null)} />
      )}
    </>
  )
}
