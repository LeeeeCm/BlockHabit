import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { blueprints, getBlueprint } from '../logic/blueprints'
import { SHOWCASE_SANDBOX_MAX } from '../logic/showcase'
import { resolveShowcaseState } from '../logic/showcaseState'
import { ShowcaseScene } from '../render/ShowcaseScene'
import { PolaroidModal } from '../components/PolaroidModal'
import { GuideTip } from '../components/GuideTip'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ShowcaseDrawer } from '../components/showcase/ShowcaseDrawer'
import { SandboxList } from '../components/showcase/SandboxList'
import { BuildingYard, type YardElsewhereEntry } from '../components/showcase/BuildingYard'
import { ModelContextMenu } from '../components/showcase/ModelContextMenu'
import { hasSeenTip, markTipSeen } from '../platform/guideTips'
import { getBlueprintName, useI18n } from '../i18n'
import { IconBulb, IconSparkle } from '../components/Icons'
import type { ShowcasePlacement } from '../types'

/** 稳定空表：store 里缺省时保持引用不变，避免每次选择器调用产生新数组 */
const EMPTY_PLACEMENTS: ShowcasePlacement[] = []

/**
 * 展台沙盘页面（D-20261127-127）：
 * - 多沙盘（左抽屉）+ 堆场（右抽屉），抽屉用 grid 0fr→1fr 平滑展开；
 * - 右键 / 长按建筑 = 旋转 90° 或收拢回堆场（旋转持久化在 placement 上）；
 * - 点击建筑查看落成纪念相纸，拖拽换位；
 * - 每个沙盘有自己的底座颜色方案（苔绿/石白/暖沙/素盘），不再生成植被。
 */
export default function Showcase() {
  const { t, lang } = useI18n()
  const sandboxesState = useAppStore((s) => s.showcaseSandboxes)
  const activeSandboxId = useAppStore((s) => s.activeSandboxId)
  const mirrorPlacements = useAppStore((s) => s.showcasePlacements ?? EMPTY_PLACEMENTS)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const updateShowcasePlacement = useAppStore((s) => s.updateShowcasePlacement)
  const rotateShowcasePlacement = useAppStore((s) => s.rotateShowcasePlacement)
  const autoArrangeShowcase = useAppStore((s) => s.autoArrangeShowcase)
  const tuckShowcaseBuilding = useAppStore((s) => s.tuckShowcaseBuilding)
  const placeShowcaseBuilding = useAppStore((s) => s.placeShowcaseBuilding)
  const switchShowcaseSandbox = useAppStore((s) => s.switchShowcaseSandbox)
  const addShowcaseSandbox = useAppStore((s) => s.addShowcaseSandbox)
  const removeShowcaseSandbox = useAppStore((s) => s.removeShowcaseSandbox)
  const setShowcaseSandboxDesign = useAppStore((s) => s.setShowcaseSandboxDesign)

  const resolved = useMemo(
    () =>
      resolveShowcaseState({
        showcaseSandboxes: sandboxesState,
        activeSandboxId,
        showcasePlacements: mirrorPlacements
      }),
    [sandboxesState, activeSandboxId, mirrorPlacements]
  )
  const sandboxes = resolved.sandboxes
  const active = resolved.active
  const activeIndex = Math.max(
    0,
    sandboxes.findIndex((sandbox) => sandbox.id === resolved.activeId)
  )
  const activePlacements = active.placements

  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  const [toast, showToast] = useTransient<string>(2400)
  const [sandboxPanelOpen, setSandboxPanelOpen] = useState(false)
  const [yardPanelOpen, setYardPanelOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [removeCandidate, setRemoveCandidate] = useState<string | null>(null)
  // 页面提示（D-20261110-054）：已有摆放时首次提示拖动/点击；挂载即标记已读。
  // 打开任一侧抽屉时让位给列表，避免浮层压住抽屉底部内容。
  const [showGuideTip, setShowGuideTip] = useState(() => !hasSeenTip('showcase'))
  const guideTipVisible =
    showGuideTip && activePlacements.length > 0 && !sandboxPanelOpen && !yardPanelOpen

  // 堆场：当前沙盘之外的落成建筑；同一座建筑全局只在一个沙盘上
  const placementIndex = useMemo(() => {
    const map = new Map<string, number>()
    resolved.sandboxes.forEach((sandbox, index) => {
      for (const p of sandbox.placements) map.set(p.blueprintId, index)
    })
    return map
  }, [resolved.sandboxes])

  const available = useMemo(
    () => completed.filter((id) => !placementIndex.has(id) && Boolean(blueprints[id])),
    [completed, placementIndex]
  )
  const elsewhere = useMemo<YardElsewhereEntry[]>(() => {
    const list: YardElsewhereEntry[] = []
    for (const id of completed) {
      const index = placementIndex.get(id)
      if (index === undefined || index === activeIndex || !blueprints[id]) continue
      list.push({ id, sandboxIndex: index })
    }
    return list
  }, [completed, placementIndex, activeIndex])
  const yardCount = available.length + elsewhere.length

  useEffect(() => {
    if (guideTipVisible) markTipSeen('showcase')
  }, [guideTipVisible])

  // 切沙盘时菜单语义已失效
  useEffect(() => {
    setContextMenu(null)
  }, [resolved.activeId])

  // Esc：先关菜单，再关右抽屉，最后关左抽屉
  useEffect(() => {
    if (!contextMenu && !sandboxPanelOpen && !yardPanelOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (contextMenu) setContextMenu(null)
      else if (yardPanelOpen) setYardPanelOpen(false)
      else setSandboxPanelOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contextMenu, sandboxPanelOpen, yardPanelOpen])

  const handleContextMenu = useCallback((blueprintId: string, x: number, y: number) => {
    setSelectedBlueprintId(null)
    setContextMenu({ id: blueprintId, x, y })
  }, [])

  function handleAutoArrange() {
    if (!autoArrangeShowcase()) showToast(t.showcase.fullHint, 2400)
  }

  function handleRotate() {
    if (!contextMenu) return
    const id = contextMenu.id
    setContextMenu(null)
    if (!rotateShowcasePlacement(id)) showToast(t.showcase.rotateBlocked, 2400)
  }

  function handleTuck() {
    if (!contextMenu) return
    const id = contextMenu.id
    setContextMenu(null)
    if (tuckShowcaseBuilding(id)) showToast(t.showcase.tucked, 2000)
  }

  function handlePlace(blueprintId: string) {
    if (placeShowcaseBuilding(blueprintId)) {
      showToast(t.showcase.yardPlaced(getBlueprintName(blueprintId, lang)), 2000)
    } else {
      showToast(t.showcase.yardFull, 2400)
    }
  }

  function handleAddSandbox() {
    if (!addShowcaseSandbox()) showToast(t.showcase.addSandboxFull, 2000)
  }

  function confirmRemoveSandbox() {
    if (!removeCandidate) return
    removeShowcaseSandbox(removeCandidate)
    setRemoveCandidate(null)
  }

  const removeIndex = removeCandidate
    ? sandboxes.findIndex((sandbox) => sandbox.id === removeCandidate)
    : -1

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {toast && <div className="toast">{toast}</div>}
      {/* 顶部标题与陈列统计 */}
      <div
        className="showcase-top-bar page-top-bar"
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          rowGap: 8,
          padding: '14px 20px',
          borderBottom: '1px solid var(--line)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            minWidth: 0,
            flexWrap: 'wrap',
            rowGap: 2
          }}
        >
          <span className="page-title" style={{ flexShrink: 0 }}>
            {t.showcase.title}
          </span>
          <span
            style={{
              fontSize: 'var(--fs-small)',
              color: 'var(--ink-2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <IconBulb size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>{t.showcase.dragHint}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 'var(--fs-small)',
              fontWeight: 600,
              color: 'var(--ink-2)',
              flexShrink: 0
            }}
          >
            {t.showcase.sandboxName(activeIndex + 1)}
          </span>

          {activePlacements.length > 0 && (
            <button
              className="btn ghost block-action"
              onClick={handleAutoArrange}
              title={t.showcase.autoArrange}
            >
              <IconSparkle size={12} style={{ color: 'var(--accent)' }} />
              <span>{t.showcase.autoArrange}</span>
            </button>
          )}

          <div className="block-action is-static" style={{ fontWeight: 600 }}>
            <span style={{ color: 'var(--progress-green)' }}>●</span>
            <span>{t.showcase.countDisplay(activePlacements.length)}</span>
          </div>
        </div>
      </div>

      {/* 2.5D 展台沙盘画布 + 左右抽屉 */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minHeight: 0,
          overflow: 'hidden',
          background: 'var(--bg)'
        }}
      >
        <ShowcaseScene
          placements={activePlacements}
          blueprintsMap={blueprints}
          onUpdatePlacement={updateShowcasePlacement}
          onSelectModel={setSelectedBlueprintId}
          onModelContextMenu={handleContextMenu}
          design={active.design ?? 'moss'}
          viewFitKey={resolved.activeId}
        />

        <ShowcaseDrawer
          side="left"
          label={t.showcase.sandboxTab}
          open={sandboxPanelOpen}
          count={sandboxes.length}
          onToggle={() => setSandboxPanelOpen((v) => !v)}
          expandLabel={t.showcase.expandPanel(t.showcase.sandboxTab)}
          collapseLabel={t.showcase.collapsePanel(t.showcase.sandboxTab)}
        >
          <SandboxList
            sandboxes={sandboxes}
            activeId={resolved.activeId}
            design={active.design ?? 'moss'}
            maxReached={sandboxes.length >= SHOWCASE_SANDBOX_MAX}
            t={t}
            onSwitch={switchShowcaseSandbox}
            onAdd={handleAddSandbox}
            onRemove={setRemoveCandidate}
            onDesign={(design) => setShowcaseSandboxDesign(resolved.activeId, design)}
          />
        </ShowcaseDrawer>

        <ShowcaseDrawer
          side="right"
          label={t.showcase.yardTab}
          open={yardPanelOpen}
          count={yardCount}
          onToggle={() => setYardPanelOpen((v) => !v)}
          expandLabel={t.showcase.expandPanel(t.showcase.yardTab)}
          collapseLabel={t.showcase.collapsePanel(t.showcase.yardTab)}
        >
          <BuildingYard
            available={available}
            elsewhere={elsewhere}
            language={lang}
            t={t}
            onPlace={handlePlace}
          />
        </ShowcaseDrawer>

        {activePlacements.length === 0 && (
          <div
            style={{
              position: 'absolute',
              left: 72,
              bottom: 24,
              padding: '12px 18px',
              background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--line)',
              fontSize: 'var(--fs-body)',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
              maxWidth: 'min(420px, calc(100% - 144px))'
            }}
          >
            {t.showcase.emptyHint}
          </div>
        )}
      </div>

      {/* 右键 / 长按建筑：旋转或收拢 */}
      {contextMenu && (
        <ModelContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          blueprintName={getBlueprintName(contextMenu.id, lang)}
          t={t}
          onRotate={handleRotate}
          onTuck={handleTuck}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* D-20261110-054：首次有摆放时给一次「拖动换位置 / 点击看相纸」提示 */}
      {guideTipVisible && (
        <GuideTip
          variant="fixed"
          title={t.guide.showcaseTitle}
          body={t.guide.showcaseBody}
          dismissLabel={t.guide.gotIt}
          onDismiss={() => setShowGuideTip(false)}
        />
      )}

      {/* 点击模型打开拍立得纪念卡 */}
      {selectedBlueprintId && (
        <PolaroidModal
          blueprint={getBlueprint(selectedBlueprintId)}
          onClose={() => setSelectedBlueprintId(null)}
        />
      )}

      {removeCandidate && (
        <ConfirmDialog
          title={t.showcase.removeSandboxConfirmTitle}
          message={t.showcase.removeSandboxConfirmMsg(
            removeIndex >= 0 ? t.showcase.sandboxName(removeIndex + 1) : ''
          )}
          confirmLabel={t.showcase.removeSandbox}
          danger
          onCancel={() => setRemoveCandidate(null)}
          onConfirm={confirmRemoveSandbox}
        />
      )}
    </div>
  )
}
