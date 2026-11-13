import { useCallback, useEffect, useRef, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { blueprintOrder, blueprints, getBlueprint } from '../logic/blueprints'
import {
  canRotatePlacement,
  findNextAvailablePlacement,
  isDecorationUnlocked,
  SHOWCASE_GRID_SIZE,
} from '../logic/showcase'
import { ShowcaseScene } from '../render/ShowcaseScene'
import { PolaroidModal } from '../components/PolaroidModal'
import { GuideTip } from '../components/GuideTip'
import { hasSeenTip, markTipSeen } from '../platform/guideTips'
import { getBlueprintName, useI18n } from '../i18n'
import { IconBulb, IconRotateCcw, IconRotateCw, IconShuffle, IconSparkle } from '../components/Icons'
import type { ShowcasePlacement } from '../types'

/** 旋转按钮触控目标（D-20261111-068 验收：移动端 ≥44px） */
const ROTATE_BUTTON_SIZE = 44

/**
 * 展台沙盘页面：
 * 自由拖拽建筑布局、AABB 无碰撞磁吸落位、点击模型查看拍立得纪念相纸。
 * D-20261111-068 自由装饰模式：全落成后解锁；会话内 90° 旋转 + 换一组植被，
 * 旋转与植被种子都只存在 React state（不写存档、不改 settings/schema，重开复原）。
 */
export default function Showcase() {
  const { t, lang } = useI18n()
  const showcasePlacements = useAppStore((s) => s.showcasePlacements ?? [])
  const updateShowcasePlacement = useAppStore((s) => s.updateShowcasePlacement)
  const completed = useAppStore((s) => s.completedBlueprintIds)
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  const [toast, showToast] = useTransient<string>(2400)
  // 页面提示（D-20261110-054）：已有摆放时首次提示拖动/点击；挂载即标记已读
  const [showGuideTip, setShowGuideTip] = useState(() => !hasSeenTip('showcase'))
  const guideTipVisible = showGuideTip && showcasePlacements.length > 0

  // 装饰模式解锁（D-20261111-068）：completedBlueprintIds 覆盖 blueprintOrder 全部；长度动态。
  const decorationUnlocked = isDecorationUnlocked(completed, blueprintOrder)
  const [decorationMode, setDecorationMode] = useState(false)
  const [decorationSelectedId, setDecorationSelectedId] = useState<string | null>(null)
  // 本次会话的 90° 象限（蓝图 id → 0/1/2/3）与植被重排种子：都不落盘
  const [rotations, setRotations] = useState<Record<string, number>>({})
  const [ecoSeed, setEcoSeed] = useState(0)

  // 拖拽落位校验需要看到「本次会话旋转」，但 action 的签名不能扩散到渲染层：
  // 用 ref 承载最新 rotations，回调本身保持稳定（ShowcaseScene 的监听器不重绑）。
  const rotationsRef = useRef(rotations)
  rotationsRef.current = rotations
  const handleUpdatePlacement = useCallback(
    (blueprintId: string, gridX: number, gridY: number) =>
      updateShowcasePlacement(blueprintId, gridX, gridY, rotationsRef.current),
    [updateShowcasePlacement]
  )

  useEffect(() => {
    if (guideTipVisible) markTipSeen('showcase')
  }, [guideTipVisible])

  // 数据若回退到「未全落成」（重置/撤销），自动收起装饰模式，不留无解锁依据的入口
  useEffect(() => {
    if (decorationUnlocked || !decorationMode) return
    setDecorationMode(false)
    setDecorationSelectedId(null)
    setRotations({})
    setEcoSeed(0)
    setSelectedBlueprintId(null)
  }, [decorationUnlocked, decorationMode])

  function handleAutoArrange() {
    const list = completed.length > 0 ? completed : ['plant']
    const next: ShowcasePlacement[] = []
    let overflow = false
    for (const id of list) {
      const p = findNextAvailablePlacement(id, next, blueprints, SHOWCASE_GRID_SIZE)
      if (!p) {
        overflow = true
        break
      }
      next.push(p)
    }
    // 逐项走 action（保留碰撞校验），不再整库 setState
    for (const p of next) {
      updateShowcasePlacement(p.blueprintId, p.gridX, p.gridY)
    }
    if (overflow) {
      showToast(t.showcase.fullHint, 2400)
    }
  }

  function exitDecorationMode() {
    // 退出装饰 = 回原行为：旋转/植被重排只存在于本次装饰会话，退出即复原（存档本就没写）
    setDecorationMode(false)
    setDecorationSelectedId(null)
    setRotations({})
    setEcoSeed(0)
  }

  function toggleDecorationMode() {
    if (decorationMode) {
      exitDecorationMode()
      return
    }
    setDecorationMode(true)
    setDecorationSelectedId(null)
    // 进入装饰前若开着拍立得则先关掉，避免两套「选中」语义重叠
    setSelectedBlueprintId(null)
  }

  function handleSelectModel(blueprintId: string) {
    if (decorationMode) {
      // 装饰模式：点击模型只选中（再次点击同一模型取消），不打开拍立得
      setDecorationSelectedId((prev) => (prev === blueprintId ? null : blueprintId))
      return
    }
    setSelectedBlueprintId(blueprintId)
  }

  function handleRotate(delta: 1 | -1) {
    const id = decorationSelectedId
    if (!decorationMode || !id) return
    const placement = showcasePlacements.find((p) => p.blueprintId === id)
    if (!placement) return
    const current = rotations[id] ?? 0
    const next = (current + delta + 4) % 4
    // 纯函数前置校验：越界或与其它模型（按其当前会话旋转）重叠则不应用，仅提示
    const ok = canRotatePlacement(
      id,
      placement.gridX,
      placement.gridY,
      next,
      showcasePlacements,
      blueprints,
      rotations,
      SHOWCASE_GRID_SIZE,
    )
    if (!ok) {
      showToast(t.showcase.rotateBlocked, 2400)
      return
    }
    setRotations((prev) => {
      const map = { ...prev }
      if (next === 0) delete map[id]
      else map[id] = next
      return map
    })
  }

  function handleEcoReshuffle() {
    // 确定性伪随机：种子自增，同一会话内可复现；仅本次会话，不落盘
    setEcoSeed((prev) => prev + 1)
    showToast(t.showcase.ecoReshuffled, 2400)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {toast && <div className="toast">{toast}</div>}
      {/* 顶部标题与陈列统计 */}
      <div
        className="showcase-top-bar"
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          rowGap: 8,
          padding: '14px 22px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-title)' }}>{t.showcase.title}</span>
          <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconBulb size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>{decorationMode ? t.showcase.decorationHint : t.showcase.dragHint}</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {decorationUnlocked && (
            <button
              className="btn ghost touch-target-mobile"
              type="button"
              onClick={toggleDecorationMode}
              aria-pressed={decorationMode}
              title={decorationMode ? t.showcase.exitDecoration : t.showcase.decoration}
              style={{
                fontSize: 'var(--fs-small)',
                padding: '4px 12px',
                borderRadius: 'var(--r-md)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                ...(decorationMode ? { borderColor: 'var(--ink)', color: 'var(--ink)' } : null),
              }}
            >
              <IconSparkle size={12} />
              <span>{decorationMode ? t.showcase.exitDecoration : t.showcase.decoration}</span>
            </button>
          )}

          {!decorationMode && showcasePlacements.length > 0 && (
            <button
              className="btn ghost"
              onClick={handleAutoArrange}
              style={{ fontSize: 'var(--fs-small)', padding: '4px 12px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}
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
              fontSize: 'var(--fs-small)',
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
          onUpdatePlacement={handleUpdatePlacement}
          onSelectModel={handleSelectModel}
          rotations={rotations}
          ecoSeed={ecoSeed}
          selectedId={decorationMode ? decorationSelectedId : null}
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
              fontSize: 'var(--fs-body)',
              color: 'var(--ink-2)',
              lineHeight: 1.6,
            }}
          >
            {t.showcase.emptyHint}
          </div>
        )}
      </div>

      {/* 装饰模式工具条：选中模型显示旋转控件；「换一组植被」始终可用 */}
      {decorationMode && (
        <div
          role="toolbar"
          aria-label={t.showcase.decoration}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 20,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            maxWidth: 'calc(100% - 24px)',
            padding: '8px 10px',
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            backdropFilter: 'blur(8px)',
            zIndex: 20,
          }}
        >
          {decorationSelectedId && (
            <>
              <span
                style={{
                  fontSize: 'var(--fs-small)',
                  color: 'var(--ink)',
                  fontWeight: 600,
                  maxWidth: 150,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getBlueprintName(decorationSelectedId, lang)}
              </span>
              <button
                className="btn ghost"
                type="button"
                onClick={() => handleRotate(-1)}
                aria-label={t.showcase.rotateLeft}
                title={t.showcase.rotateLeft}
                style={{
                  width: ROTATE_BUTTON_SIZE,
                  height: ROTATE_BUTTON_SIZE,
                  minWidth: ROTATE_BUTTON_SIZE,
                  minHeight: ROTATE_BUTTON_SIZE,
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--ink)',
                }}
              >
                <IconRotateCcw size={16} />
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => handleRotate(1)}
                aria-label={t.showcase.rotateRight}
                title={t.showcase.rotateRight}
                style={{
                  width: ROTATE_BUTTON_SIZE,
                  height: ROTATE_BUTTON_SIZE,
                  minWidth: ROTATE_BUTTON_SIZE,
                  minHeight: ROTATE_BUTTON_SIZE,
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--r-md)',
                  color: 'var(--ink)',
                }}
              >
                <IconRotateCw size={16} />
              </button>
            </>
          )}
          <button
            className="btn ghost"
            type="button"
            onClick={handleEcoReshuffle}
            title={t.showcase.ecoReshuffle}
            style={{
              fontSize: 'var(--fs-small)',
              padding: '4px 12px',
              borderRadius: 'var(--r-md)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <IconShuffle size={13} />
            <span>{t.showcase.ecoReshuffle}</span>
          </button>
        </div>
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

      {/* 点击模型打开拍立得纪念卡（装饰模式下点击语义改为选中，由 handleSelectModel 分流） */}
      {selectedBlueprintId && !decorationMode && (
        <PolaroidModal
          blueprint={getBlueprint(selectedBlueprintId)}
          onClose={() => setSelectedBlueprintId(null)}
        />
      )}
    </div>
  )
}
