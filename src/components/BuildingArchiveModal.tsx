import { useEffect, useMemo, useRef, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { getBlueprint } from '../logic/blueprints'
import { buildBuildingArchive, type BuildingArchiveState } from '../logic/buildingArchive'
import { getBlueprintName, useI18n } from '../i18n'
import { triggerHaptic, usePlatform } from '../platform'
import { useDialogA11y } from './useDialogA11y'
import { BottomSheet } from './BottomSheet'
import { IconClose, IconEdit, IconMood, IconNote, IconStar } from './Icons'
import { PolaroidModal } from './PolaroidModal'
import {
  archiveMilestoneHabitName,
  archiveMilestoneLabel,
  drawArchiveStage,
  renderArchiveCardCanvas,
  saveArchivePng,
} from '../render/buildingArchiveCanvas'

interface Props {
  blueprintId: string
  onClose: () => void
}

/**
 * 建筑档案卡弹层（B3 / D-20261110-065）：
 * 等距大图 + 落成日 + 第 N 座 + 数据（积木/耗时/投入最多/全勤日/奖励块）+ 关键块时间线
 * （点击查看当天打卡与随笔）+ 可编辑奠基石铭言 + [拍立得] [保存档案卡 PNG]。
 * 全部从现有 AppState 派生，零新字段；Esc / 焦点圈闭复用 useDialogA11y。
 */
export function BuildingArchiveModal({ blueprintId, onClose }: Props) {
  const { lang, t } = useI18n()
  // 移动端用 BottomSheet（与 ConfirmDialog / HabitDialog / SettingsDialog 同一分支范式）；
  // 桌面端保持原 overlay/dialog 行为不变。
  const { isMobile } = usePlatform()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const completedBlueprintIds = useAppStore((s) => s.completedBlueprintIds)
  const foundationNotes = useAppStore((s) => s.foundationNotes)
  const setFoundationNote = useAppStore((s) => s.setFoundationNote)
  const theme = useAppStore((s) => s.settings.theme)

  const state = useMemo<BuildingArchiveState>(
    () => ({ habits, checkIns, builds, completedBlueprintIds, foundationNotes }),
    [habits, checkIns, builds, completedBlueprintIds, foundationNotes],
  )
  const archive = useMemo(() => buildBuildingArchive(state, blueprintId), [state, blueprintId])
  const blueprint = useMemo(() => getBlueprint(blueprintId), [blueprintId])
  const blueprintName = useMemo(() => getBlueprintName(blueprintId, lang), [blueprintId, lang])

  const [toast, showToast] = useTransient<string>(2200)
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(archive.foundationNote ?? '')
  const [polaroidOpen, setPolaroidOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const stageRef = useRef<HTMLCanvasElement>(null)
  // 桌面端：Esc / 焦点圈闭由 useDialogA11y 负责；移动端交给 BottomSheet 自身（Esc）与
  // 抽屉手势；嵌套拍立得打开时两边都让位，由 PolaroidModal 的 useDialogA11y 接管。
  const { ref: dialogRef } = useDialogA11y({
    open: true,
    onClose,
    enabled: !isMobile && !polaroidOpen,
  })

  // 铭言保存后 / 外部变更时同步草稿（编辑中不覆盖用户输入）
  useEffect(() => {
    if (!editingNote) setNoteDraft(archive.foundationNote ?? '')
  }, [archive.foundationNote, editingNote])

  // 等距预览：主题变化时重绘（颜色在绘制时从 document 令牌读取）
  useEffect(() => {
    const canvas = stageRef.current
    if (!canvas || !archive.completed) return
    let alive = true
    void drawArchiveStage(canvas, blueprint, archive.bonusByIndex).catch((error: unknown) => {
      if (alive) console.warn('[archive] stage draw failed', error)
    })
    return () => {
      alive = false
    }
  }, [blueprint, archive.completed, archive.bonusByIndex, theme])

  const milestone =
    selectedMilestone !== null ? (archive.milestones[selectedMilestone] ?? null) : null
  const a = t.buildingArchive

  async function handleSavePng() {
    if (saving || !archive.completed) return
    setSaving(true)
    try {
      const canvas = await renderArchiveCardCanvas({ archive, blueprint, blueprintName, t, lang })
      const ok = await saveArchivePng(canvas, blueprintId)
      if (!ok) console.warn('[archive] PNG export failed')
    } catch (error: unknown) {
      console.warn('[archive] PNG export failed', error)
    } finally {
      setSaving(false)
    }
  }

  function handleSaveNote() {
    setFoundationNote(blueprintId, noteDraft)
    setEditingNote(false)
    showToast(t.reflections.foundationSavedToast, 2200)
  }

  const metricCells: Array<{ label: string; value: string }> = [
    { label: a.metrics.blocks, value: String(archive.totalBlocks) },
    { label: a.metrics.days, value: archive.days === null ? '—' : a.daysValue(archive.days) },
    {
      label: a.metrics.topHabit,
      value:
        archive.topHabit === null
          ? '—'
          : a.topHabitValue(archive.topHabit.name || '—', archive.topHabit.count),
    },
    { label: a.metrics.perfectDays, value: String(archive.dayClaimBlocks) },
    { label: a.metrics.bonusBlocks, value: String(archive.bonusBlocks) },
  ]

  const titleContent = (
    <>
      <IconNote size={18} style={{ flexShrink: 0 }} />
      <span>{a.title}</span>
    </>
  )

  // 桌面 / 移动共用同一份主体与底栏；只有外壳不同（overlay+dialog ↔ BottomSheet）。
  const bodyContent = (
    <>
            {!archive.completed ? (
              <div style={{ textAlign: 'center', padding: '40px 12px' }}>
                <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, marginBottom: 8 }}>
                  {blueprintName}
                </div>
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-2)' }}>{a.empty}</div>
              </div>
            ) : (
              <>
                {/* 建筑名 + 落成日 + 第 N 座 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-heading)', fontWeight: 700 }}>{blueprintName}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span
                      aria-hidden="true"
                      style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
                      {archive.completedAt ? a.completedAt(archive.completedAt) : a.empty}
                    </span>
                    {archive.ordinal !== null && (
                      <span
                        style={{
                          fontSize: 'var(--fs-caption)',
                          color: 'var(--ink-2)',
                          border: '1px solid var(--line)',
                          borderRadius: 999,
                          padding: '1px 8px',
                          flexShrink: 0,
                        }}
                      >
                        {a.nth(archive.ordinal)}
                      </span>
                    )}
                  </span>
                </div>

                {/* 等距大图 */}
                <canvas
                  ref={stageRef}
                  data-testid="archive-stage"
                  role="img"
                  aria-label={blueprintName + ' · ' + a.completedAt(archive.completedAt ?? '')}
                  style={{
                    width: '100%',
                    aspectRatio: '640 / 260',
                    height: 'auto',
                    display: 'block',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                  }}
                />

                {/* 数据格 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  {metricCells.map((cell) => (
                    <div
                      key={cell.label}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--r-sm)',
                        padding: '8px 10px',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)' }}>{cell.label}</div>
                      <div
                        style={{
                          fontSize: 'var(--fs-body)',
                          fontWeight: 700,
                          color: 'var(--ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={cell.value}
                      >
                        {cell.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 时间线：关键块 → 当天打卡与随笔 */}
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 'var(--fs-small)', fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
                    {a.timeline}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {archive.milestones.map((entry, index) => {
                      const selected = index === selectedMilestone
                      const label = archiveMilestoneLabel(t, entry)
                      return (
                        <button
                          key={entry.blockId || index}
                          type="button"
                          className="pill-action"
                          aria-pressed={selected}
                          onClick={() => {
                            triggerHaptic('selection')
                            setSelectedMilestone((prev) => (prev === index ? null : index))
                          }}
                          title={entry.date || undefined}
                          style={{
                            fontSize: 'var(--fs-caption)',
                            padding: '3px 10px',
                            color: selected ? 'var(--ink)' : 'var(--ink-2)',
                            background: selected
                              ? 'color-mix(in srgb, var(--ink) 6%, transparent)'
                              : undefined,
                            borderColor: selected ? 'var(--ink)' : undefined,
                          }}
                        >
                          {label}
                          {entry.date ? ' · ' + entry.date : ''}
                          {entry.starred && (
                            <IconStar size={11} filled style={{ color: 'var(--accent)', marginLeft: 4 }} />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {milestone && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '10px 12px',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--r-sm)',
                        background: 'color-mix(in srgb, var(--ink) 2%, transparent)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 'var(--fs-small)', fontWeight: 700, color: 'var(--ink)' }}>
                          {t.reflections.brickInspectTitle(milestone.index)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {milestone.starred && (
                            <IconStar size={12} filled style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          )}
                          {milestone.mood && (
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
                                gap: 3,
                              }}
                            >
                              <IconMood mood={milestone.mood} size={11} style={{ flexShrink: 0 }} />
                              <span>{t.microMood[milestone.mood]}</span>
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginBottom: 6 }}>
                        {t.reflections.brickInspectFrom(
                          archiveMilestoneHabitName(t, milestone),
                          milestone.date || '—',
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--fs-small)',
                          color: 'var(--ink)',
                          lineHeight: 1.5,
                          fontStyle: milestone.note ? 'normal' : 'italic',
                          opacity: milestone.note ? 0.95 : 0.6,
                        }}
                      >
                        {milestone.note || t.reflections.brickInspectNoNote}
                      </div>
                    </div>
                  )}
                </div>

                {/* 奠基石铭言（可编辑，不新增字段） */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 'var(--fs-small)', fontWeight: 600, color: 'var(--ink-2)' }}>
                      {a.noteLabel}
                    </span>
                    {!editingNote && (
                      <button
                        className="btn ghost"
                        style={{
                          padding: '2px 10px',
                          fontSize: 'var(--fs-caption)',
                          borderRadius: 999,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          flexShrink: 0,
                        }}
                        onClick={() => {
                          setNoteDraft(archive.foundationNote ?? '')
                          setEditingNote(true)
                        }}
                      >
                        <IconEdit size={12} style={{ flexShrink: 0 }} />
                        <span>{t.common.edit}</span>
                      </button>
                    )}
                  </div>

                  {editingNote ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        autoFocus
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder={a.notePlaceholder}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 'var(--r-sm)',
                          border: '1px solid var(--line)',
                          background: 'color-mix(in srgb, var(--ink) 2%, transparent)',
                          fontSize: 'var(--fs-body)',
                          color: 'var(--ink)',
                          resize: 'none',
                          outline: 'none',
                          lineHeight: 1.5,
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setEditingNote(false)
                            return
                          }
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault()
                            handleSaveNote()
                          }
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button
                          className="btn ghost"
                          style={{ padding: '4px 12px', fontSize: 'var(--fs-small)', borderRadius: 999 }}
                          onClick={() => setEditingNote(false)}
                        >
                          {t.common.cancel}
                        </button>
                        <button
                          className="btn primary"
                          style={{ padding: '4px 12px', fontSize: 'var(--fs-small)', borderRadius: 999 }}
                          onClick={handleSaveNote}
                        >
                          {a.saveNote}
                        </button>
                      </div>
                    </div>
                  ) : archive.foundationNote ? (
                    <div style={{ marginTop: 6, fontSize: 'var(--fs-body)', color: 'var(--ink)', fontStyle: 'italic', lineHeight: 1.6 }}>
                      “{archive.foundationNote}”
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 'var(--fs-small)', color: 'var(--ink-2)' }}>
                      {a.notePlaceholder}
                    </div>
                  )}
                </div>
              </>
            )}
    </>
  )

  const footerActions = (
    <>
      {archive.completed && (
        <>
          <button
            className="btn ghost"
            onClick={() => {
              triggerHaptic('light')
              setPolaroidOpen(true)
            }}
          >
            {a.polaroid}
          </button>
          <button className="btn primary" disabled={saving} onClick={() => void handleSavePng()}>
            {a.savePng}
          </button>
        </>
      )}
      <button className="btn ghost" onClick={onClose}>
        {a.close}
      </button>
    </>
  )

  // 移动端底栏：沿用 .dialog-footer 的按钮排布，去掉外壳边框/内边距（BottomSheet footer 自带）。
  const mobileFooter = (
    <div className="dialog-footer" style={{ borderTop: 'none', padding: 0 }}>
      {footerActions}
    </div>
  )

  // 移动端嵌套拍立得：BottomSheet 根 z-index 1000 高于 PolaroidModal overlay 的 120，
  // 直接嵌套会被抽屉盖住。用零尺寸 stacking wrapper（position:relative + zIndex:1001）
  // 把拍立得抬到抽屉之上；不改 PolaroidModal 自身（B2 文件），也不改任何视觉样式。
  const polaroidLayer = polaroidOpen ? (
    <div style={isMobile ? { position: 'relative', zIndex: 1001 } : undefined}>
      <PolaroidModal blueprint={blueprint} onClose={() => setPolaroidOpen(false)} />
    </div>
  ) : null

  if (isMobile) {
    return (
      <>
        <BottomSheet
          open={true}
          onClose={onClose}
          title={titleContent}
          footer={mobileFooter}
          escEnabled={!polaroidOpen}
        >
          {bodyContent}
          {toast && <div className="toast">{toast}</div>}
        </BottomSheet>
        {polaroidLayer}
      </>
    )
  }

  return (
    <>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="building-archive-title"
        tabIndex={-1}
        className="overlay"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        style={{ zIndex: 115 }}
      >
        <div
          className="dialog"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ width: 720, maxWidth: '94vw', maxHeight: '92vh' }}
        >
          <div className="dialog-header">
            <h3
              id="building-archive-title"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}
            >
              {titleContent}
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

          {toast && <div className="toast">{toast}</div>}
        </div>
      </div>

      {polaroidLayer}
    </>
  )
}
