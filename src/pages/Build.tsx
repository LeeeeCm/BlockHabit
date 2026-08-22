import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { getBlueprint, blueprints } from '../logic/blueprints'
import { BuildScene } from '../render/BuildScene'

export default function Build() {
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const chooseBlueprint = useAppStore((s) => s.chooseBlueprint)

  const blueprint = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const total = blueprint.blocks.length
  const complete = placedCount >= total

  const [animateIndex, setAnimateIndex] = useState<number | null>(null)
  const [ceremonyShown, setCeremonyShown] = useState(false)

  useEffect(() => {
    if (placedCount > 0) setAnimateIndex(placedCount - 1)
  }, [placedCount])

  const available = useMemo(
    () => Object.values(blueprints).filter((b) => b.id !== activeBlueprintId),
    [activeBlueprintId],
  )

  const showCeremony = complete && !ceremonyShown

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 20px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>{blueprint.name}</span>
        <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>
          {placedCount} / {total} 块
        </span>
        <div style={{ flex: 1, height: 3, background: 'var(--line)', maxWidth: 260 }}>
          <div
            style={{
              width: `${(placedCount / total) * 100}%`,
              height: '100%',
              background: complete ? 'var(--accent)' : 'var(--ink)',
              transition: 'width 0.4s ease-out',
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <BuildScene
          blueprint={blueprint}
          placedCount={placedCount}
          animateIndex={animateIndex}
          onAnimated={() => setAnimateIndex(null)}
        />

        {placedCount === 0 && (
          <div
            style={{
              position: 'absolute',
              left: 20,
              bottom: 18,
              color: 'var(--ink-2)',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            虚线是「{blueprint.name}」的蓝图。
            <br />
            回到「今日」完成打卡，积木会一块块落下。
          </div>
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
            <h2 style={{ fontSize: 26, margin: 0, letterSpacing: '0.2em' }}>落 成</h2>
            <p style={{ color: 'var(--ink-2)', margin: 0, fontSize: 14 }}>
              「{blueprint.name}」已由你亲手拼完 · 共 {total} 块
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              {available.map((b) => (
                <button key={b.id} className="btn" onClick={() => chooseBlueprint(b.id)}>
                  下一座：{b.name}
                </button>
              ))}
              <button className="btn ghost" onClick={() => setCeremonyShown(true)}>
                稍后再说
              </button>
            </div>
          </div>
        )}
      </div>
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
