import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { getTimePeriod } from '../render/iso'
import { blueprintOrder, blueprints, getBlueprint } from '../logic/blueprints'
import { getBlueprintName, useI18n } from '../i18n'
import { BuildScene } from '../render/BuildScene'
import { GalleryDialog } from '../components/GalleryDialog'
import { PolaroidModal } from '../components/PolaroidModal'
import { FoundationNoteDialog } from '../components/FoundationNoteDialog'
import { GuideTip } from '../components/GuideTip'
import { IconCamera, IconEcho, IconFoundation, IconGallery, IconRotateCcw, IconRotateCw, IconSparkle } from '../components/Icons'
import { triggerHaptic } from '../platform'
import { hasSeenTip, markTipSeen } from '../platform/guideTips'
export default function Build() {
  const { lang, t } = useI18n()
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const chooseBlueprint = useAppStore((s) => s.chooseBlueprint)
  const completedBlueprintIds = useAppStore((s) => s.completedBlueprintIds)
  const blueprint = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const total = blueprint.blocks.length
  // 进度不得超过 100%：多端离线各自建满后合并可能让投影块数短暂超出蓝图容量
  const progressRatio = total > 0 ? Math.min(1, placedCount / total) : 0
  const complete = placedCount >= total

  // 已建成的蓝图被查看时不重播落成仪式；本会话内拼满时才触发
  const [ceremonyShown, setCeremonyShown] = useState(() => placedCount >= total)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [polaroidOpen, setPolaroidOpen] = useState(false)
  const [foundationModalOpen, setFoundationModalOpen] = useState(false)
  const foundationNote = useAppStore((s) => s.foundationNotes?.[blueprint.id])
  const [rotation, setRotation] = useState(0)
  // 透视考古默认态来自设置（enableXRayInspection），页内切换只影响本会话
  const xrayDefault = useAppStore((s) => s.settings.enableXRayInspection === true)
  const [xrayMode, setXrayMode] = useState(xrayDefault)
  const enableAmbientLighting = useAppStore((s) => s.settings.enableAmbientLighting !== false)
  const period = getTimePeriod()
  // 页面提示（D-20261110-054）：首次进入且已有积木时出现一次；挂载即标记已读，避免不点就永远重复
  const [showGuideTip, setShowGuideTip] = useState(() => !hasSeenTip('build'))
  const guideTipVisible = showGuideTip && placedCount >= 1
  useEffect(() => {
    if (guideTipVisible) markTipSeen('build')
  }, [guideTipVisible])
  useEffect(() => {
    setCeremonyShown(
      builds.filter((b) => b.blueprintId === activeBlueprintId).length >=
        getBlueprint(activeBlueprintId).blocks.length,
    )
  }, [activeBlueprintId])

  const showCeremony = complete && !ceremonyShown

  const nextChoice = useMemo(() => {
    const idx = blueprintOrder.indexOf(activeBlueprintId)
    const nextId = blueprintOrder[(idx + 1) % blueprintOrder.length]
    return blueprints[nextId]
  }, [activeBlueprintId])

  /** F2：全部蓝图落成 —— 打卡不再产块，必须显式告知，而不是静默无反应 */
  const allBlueprintsDone = completedBlueprintIds.length >= blueprintOrder.length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div
        className="build-top-bar"
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 20px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-title)' }}>{getBlueprintName(blueprint.id, lang)}</span>
        <span style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-body)' }}>
          {t.build.blocksCount(placedCount, total)}
        </span>
        <div style={{ flex: 1, height: 6, background: 'var(--line)', maxWidth: 260, borderRadius: 999 }}>
          <div
            style={{
              width: `${progressRatio * 100}%`,
              height: '100%',
              background: complete ? 'var(--progress-green)' : 'var(--ink)',
              borderRadius: 999,
              transition: 'width var(--dur-xl) var(--ease-bounce)',
            }}
          />
        </div>
        {complete && (
          <>
            <button
              className="btn ghost"
              style={{ padding: '7px 12px', fontSize: 'var(--fs-body)' }}
              onClick={() => setFoundationModalOpen(true)}
              title={t.reflections.foundationModalTitle}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconFoundation size={15} style={{ flexShrink: 0 }} />
                <span>{foundationNote ? t.build.dedication : t.build.dedicate}</span>
              </span>
            </button>
            <button
              className="btn ghost"
              style={{ padding: '7px 12px', fontSize: 'var(--fs-body)' }}
              onClick={() => setPolaroidOpen(true)}
              title={t.build.polaroidBtn}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconCamera size={15} />
                {t.build.polaroidBtn}
              </span>
            </button>
          </>
        )}
        {enableAmbientLighting && (
          <span
            className="btn ghost"
            style={{ padding: '7px 12px', fontSize: 'var(--fs-body)', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default' }}
            title={t.build.ambientHint}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            {period === 'dawn' ? t.build.ambientDawn : period === 'dusk' ? t.build.ambientDusk : period === 'night' ? t.build.ambientNight : t.build.ambientNoon}
          </span>
        )}
        <button
          className={`btn ${xrayMode ? 'primary' : 'ghost'}`}
          style={{ padding: '7px 12px', fontSize: 'var(--fs-body)', borderRadius: 999 }}
          onClick={() => {
            triggerHaptic('selection')
            setXrayMode((v) => !v)
          }}
          title={t.build.xray.toggleTooltip}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconEcho size={15} style={{ color: xrayMode ? 'var(--accent)' : 'currentColor' }} />
            <span>{t.build.xray.btn}</span>
          </span>
        </button>
        <button
          className="btn ghost"
          style={{ padding: '7px 14px', fontSize: 'var(--fs-body)' }}
          onClick={() => setGalleryOpen(true)}
          title={t.build.galleryBtn}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconGallery size={16} />
            {t.build.galleryBtn}
          </span>
        </button>
      </div>

      {/* F2：全部蓝图落成 —— 在顶栏下方常驻一行说明，而不是静默无反应 */}
      {allBlueprintsDone && (
        <div
          style={{
            flex: 'none',
            padding: '8px 20px',
            fontSize: 'var(--fs-caption)',
            color: 'var(--ink-2)',
            borderBottom: '1px solid var(--line)',
            lineHeight: 1.5,
          }}
        >
          {t.build.allDoneHint(blueprintOrder.length)}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            right: 18,
            top: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: 'var(--surface)',
            padding: '3px 8px',
            borderRadius: 999,
            border: '1px solid var(--line)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            zIndex: 5,
          }}
        >
          <button
            className="icon-btn"
            onClick={() => setRotation((r) => (r - 1 + 4) % 4)}
            title={t.build.rotCcw}
            style={{ width: 28, height: 28, borderRadius: 999 }}
          >
            <IconRotateCcw size={15} />
          </button>
          <span
            style={{
              fontSize: 'var(--fs-small)',
              fontWeight: 600,
              color: 'var(--ink-2)',
              minWidth: 32,
              textAlign: 'center',
              userSelect: 'none',
            }}
          >
            {rotation * 90}°
          </span>
          <button
            className="icon-btn"
            onClick={() => setRotation((r) => (r + 1) % 4)}
            title={t.build.rotCw}
            style={{ width: 28, height: 28, borderRadius: 999 }}
          >
            <IconRotateCw size={15} />
          </button>
        </div>

        <BuildScene
          blueprint={blueprint}
          placedCount={placedCount}
          rotation={rotation}
          interactiveInspect={true}
          xrayMode={xrayMode}
        />

        {complete && foundationNote && (
          <div
            style={{
              position: 'absolute',
              left: 20,
              bottom: 18,
              padding: '7px 14px',
              background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              maxWidth: 420,
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              cursor: 'pointer',
              zIndex: 5,
            }}
            onClick={() => setFoundationModalOpen(true)}
            title={t.reflections.brickInspectEditHint}
          >
            <IconFoundation size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
            <span
              style={{
                fontSize: 'var(--fs-small)',
                color: 'var(--ink)',
                fontStyle: 'italic',
                opacity: 0.9,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              “{foundationNote}”
            </span>
          </div>
        )}

        {placedCount === 0 && (
          <div
            style={{
              position: 'absolute',
              left: 20,
              bottom: 18,
              color: 'var(--ink-2)',
              fontSize: 'var(--fs-body)',
              lineHeight: 1.7,
            }}
          >
            <span style={{ whiteSpace: 'pre-line' }}>
              {t.build.foundationGuide(getBlueprintName(blueprint.id, lang))}
            </span>
          </div>
        )}

        {guideTipVisible && (
          <GuideTip
            variant="fixed"
            title={t.guide.buildTitle}
            body={t.guide.buildBody}
            dismissLabel={t.guide.gotIt}
            onDismiss={() => setShowGuideTip(false)}
          />
        )}

        {showCeremony && (
          <div
            className="ceremony"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              zIndex: 10,
            }}
          >
            <Confetti />
            <h2 style={{ fontSize: 'var(--fs-hero)', margin: 0, letterSpacing: '0.04em' }}>
              {t.build.ceremonyTitle(getBlueprintName(blueprint.id, lang))}
            </h2>
            <p style={{ color: 'var(--ink-2)', margin: 0, fontSize: 'var(--fs-subhead)' }}>
              {t.build.ceremonySubtitle(total)}
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              <button
                className="btn primary"
                onClick={() => setFoundationModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconFoundation size={15} style={{ flexShrink: 0 }} />
                <span>{t.reflections.foundationSave}</span>
              </button>
              <button
                className="btn ghost"
                onClick={() => setPolaroidOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconCamera size={16} />
                <span>{t.build.polaroidBtn}</span>
              </button>
              {allBlueprintsDone ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 999,
                    fontSize: 'var(--fs-small)',
                    color: 'var(--ink-2)',
                    background: 'color-mix(in srgb, var(--ink) 6%, transparent)',
                  }}
                  title={t.build.allDoneHint(blueprintOrder.length)}
                >
                  <IconSparkle size={13} style={{ color: 'var(--accent)' }} />
                  {t.build.allDoneBadge}
                </span>
              ) : (
                nextChoice && (
                  <button className="btn" onClick={() => chooseBlueprint(nextChoice.id)}>
                    {t.build.nextTargetPrompt(getBlueprintName(nextChoice.id, lang))}
                  </button>
                )
              )}
              <button className="btn ghost" onClick={() => setCeremonyShown(true)}>
                {t.common.close}
              </button>
            </div>
          </div>
        )}
      </div>

      {galleryOpen && <GalleryDialog onClose={() => setGalleryOpen(false)} />}
      {polaroidOpen && <PolaroidModal blueprint={blueprint} onClose={() => setPolaroidOpen(false)} />}
      {foundationModalOpen && (
        <FoundationNoteDialog blueprintId={blueprint.id} onClose={() => setFoundationModalOpen(false)} />
      )}
    </div>
  )
}
/** 落成仪式粒子：黑白灰 + 少量点缀色方块飘落 */
function Confetti() {
  const pieces = useMemo(() => {
    const colors = ['var(--ink)', 'var(--ink-2)', 'var(--line)', 'var(--accent)']
    return Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.4 + Math.random() * 1.2,
      size: 5 + Math.random() * 7,
      color: colors[i % colors.length],
      rot: Math.random() * 360,
    }))
  }, [])
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: -20,
            width: p.size,
            height: p.size,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            animation: `confetti-fall ${p.dur}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`@keyframes confetti-fall {
        to { transform: translateY(110vh) rotate(340deg); opacity: 0.6; }
      }`}</style>
    </div>
  )
}
