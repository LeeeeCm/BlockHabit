import { useMemo, useState, type CSSProperties } from 'react'
import { useAppStore } from '../store/appStore'
import { blueprintOrder, getBlueprint } from '../logic/blueprints'
import { getBlueprintName, useI18n } from '../i18n'
import { triggerHaptic, usePlatform } from '../platform'
import { useDialogA11y } from './useDialogA11y'
import { BottomSheet } from './BottomSheet'
import { SelectMenu } from './SelectMenu'
import { ArchiveExportPanel } from './ArchiveExportPanel'
import { BuildingArchiveModal } from './BuildingArchiveModal'
import { MonthlyPosterModal } from './MonthlyPosterModal'
import { PolaroidModal } from './PolaroidModal'
import { YearbookModal } from './YearbookModal'
import { IconCamera, IconClose, IconFoundation, IconGallery, IconPoster } from './Icons'

interface Props {
  onClose: () => void
}

const CARD_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  textAlign: 'left',
  padding: '12px 14px',
  borderRadius: 'var(--r-md)',
  border: '1px solid var(--line)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  cursor: 'pointer',
  minWidth: 0
}

const SMALL_BTN: CSSProperties = {
  padding: '5px 12px',
  fontSize: 'var(--fs-small)',
  borderRadius: 'var(--r-sm)'
}

/**
 * 纪念品中心（D-20261124-084）：
 * 统计页的单一导出入口——月度画报 / 落成年鉴 / 建筑档案 / 拍立得 / 完整档案包。
 * 只聚合既有表面，不新增画布、不新增数据字段。
 */
export function MemorabiliaDialog({ onClose }: Props) {
  const { t, lang } = useI18n()
  const { isMobile } = usePlatform()
  const completedBlueprintIds = useAppStore((s) => s.completedBlueprintIds)

  const [posterOpen, setPosterOpen] = useState(false)
  const [yearbookOpen, setYearbookOpen] = useState(false)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [polaroidId, setPolaroidId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')

  const completedOrdered = useMemo(
    () => blueprintOrder.filter((id) => completedBlueprintIds.includes(id)),
    [completedBlueprintIds]
  )
  const selected =
    selectedId && completedOrdered.includes(selectedId) ? selectedId : (completedOrdered[0] ?? '')
  const nestedOpen = posterOpen || yearbookOpen || archiveId !== null || polaroidId !== null

  const { ref: dialogRef } = useDialogA11y({
    open: true,
    onClose,
    enabled: !isMobile && !nestedOpen
  })

  const bodyContent = (
    <>
      <div
        style={{
          fontSize: 'var(--fs-small)',
          color: 'var(--ink-2)',
          marginBottom: 14
        }}
      >
        {t.stats.memorabiliaSubtitle}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10
        }}
      >
        <button
          type="button"
          style={CARD_STYLE}
          onClick={() => {
            triggerHaptic('light')
            setPosterOpen(true)
          }}
        >
          <IconPoster size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{t.stats.posterBtn}</span>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>
              {t.stats.posterTooltip}
            </span>
          </span>
        </button>

        <button
          type="button"
          style={CARD_STYLE}
          onClick={() => {
            triggerHaptic('light')
            setYearbookOpen(true)
          }}
        >
          <IconGallery size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600 }}>{t.yearbook.entry}</span>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>
              {t.yearbook.entryTooltip}
            </span>
          </span>
        </button>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        <div
          style={{
            fontSize: 'var(--fs-caption)',
            fontWeight: 700,
            color: 'var(--ink-2)',
            marginBottom: 8
          }}
        >
          {t.stats.memorabiliaBuildings}
        </div>
        {completedOrdered.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
            {t.stats.memorabiliaNoBuildings}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <SelectMenu
              ariaLabel={t.stats.memorabiliaPick}
              value={selected}
              onChange={setSelectedId}
              options={completedOrdered.map((id) => ({
                value: id,
                label: getBlueprintName(id, lang)
              }))}
              style={{ flex: '1 1 180px', minWidth: 150 }}
            />
            <button
              className="btn ghost"
              style={SMALL_BTN}
              onClick={() => {
                triggerHaptic('light')
                setArchiveId(selected)
              }}
            >
              <IconFoundation size={13} style={{ marginRight: 5 }} />
              {t.stats.memorabiliaOpenArchive}
            </button>
            <button
              className="btn ghost"
              style={SMALL_BTN}
              onClick={() => {
                triggerHaptic('light')
                setPolaroidId(selected)
              }}
            >
              <IconCamera size={13} style={{ marginRight: 5 }} />
              {t.stats.memorabiliaOpenPolaroid}
            </button>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
        <ArchiveExportPanel />
      </div>
    </>
  )

  const footerActions = (
    <button className="btn ghost" onClick={onClose}>
      {t.common.close}
    </button>
  )

  const layers = (
    <>
      {posterOpen && <MonthlyPosterModal onClose={() => setPosterOpen(false)} />}
      {yearbookOpen && <YearbookModal onClose={() => setYearbookOpen(false)} />}
      {archiveId && (
        <BuildingArchiveModal blueprintId={archiveId} onClose={() => setArchiveId(null)} />
      )}
      {polaroidId && (
        <PolaroidModal blueprint={getBlueprint(polaroidId)} onClose={() => setPolaroidId(null)} />
      )}
    </>
  )

  if (isMobile) {
    return (
      <>
        <BottomSheet
          open={true}
          onClose={onClose}
          title={t.stats.memorabiliaTitle}
          footer={
            <div className="dialog-footer" style={{ borderTop: 'none', padding: 0 }}>
              {footerActions}
            </div>
          }
          escEnabled={!nestedOpen}
        >
          {bodyContent}
        </BottomSheet>
        {layers}
      </>
    )
  }

  return (
    <>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="memorabilia-title"
        tabIndex={-1}
        className="overlay"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        style={{ zIndex: 110 }}
      >
        <div
          className="dialog"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ width: 560, maxWidth: '94vw', maxHeight: '92vh' }}
        >
          <div className="dialog-header">
            <h3
              id="memorabilia-title"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <IconGallery size={18} />
              <span>{t.stats.memorabiliaTitle}</span>
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
          <div className="dialog-body">{bodyContent}</div>
          <div className="dialog-footer">{footerActions}</div>
        </div>
      </div>
      {layers}
    </>
  )
}
