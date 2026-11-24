import { useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import {
  blueprintCatalogIds,
  blueprintOrder,
  getBlueprint,
  isPetBlueprintId,
  PET_BLUEPRINT_IDS
} from '../logic/blueprints'
import { blueprintProgress, canSelectBlueprint } from '../logic/blueprint'
import { getBlueprintName, useI18n, type Language, type TranslationSchema } from '../i18n'
import type { PlacedBlock } from '../types'
import { IconClose, IconNote } from './Icons'
import { BlueprintThumb } from './BlueprintThumb'
import { BuildingArchiveModal } from './BuildingArchiveModal'
import { triggerHaptic } from '../platform'
import { useDialogA11y } from './useDialogA11y'

interface GalleryCardProps {
  id: string
  builds: readonly PlacedBlock[]
  completed: readonly string[]
  activeId: string
  lang: Language
  t: TranslationSchema
  onSelect: (id: string) => void
  onOpenArchive: (id: string) => void
}

function GalleryCard({
  id,
  builds,
  completed,
  activeId,
  lang,
  t,
  onSelect,
  onOpenArchive
}: GalleryCardProps) {
  const bp = getBlueprint(id)
  const { placed, total, complete } = blueprintProgress(builds, id)
  const isPet = isPetBlueprintId(id)
  const done = isPet ? complete : completed.includes(id)
  const building = !done && (id === activeId || (isPet && placed > 0))
  const locked = !canSelectBlueprint(id, completed)
  const bpName = getBlueprintName(id, lang)
  const status = done
    ? `${t.gallery.completed} · ${t.build.blocksCount(total, total)}`
    : building
      ? `${t.gallery.inProgress} · ${placed}/${total}`
      : locked
        ? t.gallery.locked
        : `${t.build.startBuildBtn} · ${t.gallery.totalBlocks(total)}`
  const statusColor = done
    ? 'var(--progress-green)'
    : building
      ? 'var(--progress-blue)'
      : 'var(--ink-2)'
  return (
    <div style={{ position: 'relative', minWidth: 0, display: 'flex' }}>
      <button
        type="button"
        className={`gallery-card${locked ? ' locked' : ''}`}
        onClick={() => onSelect(id)}
        title={locked ? t.gallery.completePreviousFirst : bpName}
        aria-disabled={locked}
        style={{
          width: '100%',
          paddingBottom: done ? 34 : undefined,
          // B1：锁定信息由剪影传达，不能把名字一同压暗。
          opacity: locked ? 1 : undefined
        }}
      >
        <BlueprintThumb blueprint={bp} silhouette={locked} />
        <div className="gallery-name">{bpName}</div>
        <div className="gallery-status" style={{ color: statusColor }}>
          {status}
        </div>
      </button>
      {done && (
        <button
          type="button"
          className="pill-action"
          onClick={() => onOpenArchive(id)}
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
}

interface GalleryDialogProps {
  onClose: () => void
  /** 从桌宠设置进入时，先显示支线；其余入口仍先显示主线。 */
  petFirst?: boolean
}

export function GalleryDialog({ onClose, petFirst = false }: GalleryDialogProps) {
  const { lang, t } = useI18n()
  const builds = useAppStore((s) => s.builds)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const activeId = useAppStore((s) => s.activeBlueprintId)
  const choose = useAppStore((s) => s.chooseBlueprint)
  const [toast, showToast] = useTransient<string>(2200)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  // 档案卡叠在图鉴之上：档案打开时让出 Esc/焦点，避免一次 Esc 连关两层
  const { ref: dialogRef } = useDialogA11y({ open: true, onClose, enabled: archiveId === null })

  function handleSelect(id: string): void {
    if (!canSelectBlueprint(id, useAppStore.getState().completedBlueprintIds)) {
      showToast(t.gallery.completePreviousFirst)
      return
    }
    choose(id)
    onClose()
  }

  function handleOpenArchive(id: string): void {
    triggerHaptic('selection')
    setArchiveId(id)
  }

  function renderCards(ids: readonly string[]) {
    return (
      <div className="gallery-grid">
        {ids.map((id) => (
          <GalleryCard
            key={id}
            id={id}
            builds={builds}
            completed={completed}
            activeId={activeId}
            lang={lang}
            t={t}
            onSelect={handleSelect}
            onOpenArchive={handleOpenArchive}
          />
        ))}
      </div>
    )
  }

  const petSection = (
    <section aria-labelledby="gallery-pet-blueprints-title" style={{ display: 'grid', gap: 8 }}>
      <h4 id="gallery-pet-blueprints-title" style={{ margin: 0, fontSize: 'var(--fs-subhead)' }}>
        {t.pet.blueprints}
      </h4>
      {renderCards(PET_BLUEPRINT_IDS)}
    </section>
  )

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
              {t.gallery.title} · {blueprintCatalogIds.length}
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

          <div className="dialog-body" style={{ display: 'grid', gap: 12 }}>
            {petFirst && petSection}
            {renderCards(blueprintOrder)}
            {!petFirst && petSection}
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
