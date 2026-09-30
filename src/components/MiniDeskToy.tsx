import { useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { getBlueprint } from '../logic/blueprints'
import { isHabitDueOnDay } from '../logic/checkin'
import { todayKey } from '../logic/dates'
import { BuildScene } from '../render/BuildScene'
import { playCelebrationSound, playJellySound, playSnapSound } from '../audio/sound'
import { getBlueprintName, useI18n } from '../i18n'
import { IconExpand, IconWinClose } from './Icons'
import logoUrl from '../assets/logo-mark.svg'

interface Props {
  onExpand: () => void
  onClose: () => void
}

/**
 * 桌面灵动摆件 / 迷你伴侣小窗（Mini Desk Toy）：
 * 紧凑小巧，展示正在拼建的 3D 建筑与进度；提供今日待办 1-Tap 快捷打卡，咔哒即刻掉落积木。
 */
export function MiniDeskToy({ onExpand, onClose }: Props) {
  const { lang, t } = useI18n()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const checkIn = useAppStore((s) => s.checkIn)
  const [toast, setToast] = useState<string | null>(null)

  const day = todayKey()
  const blueprint = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const total = blueprint.blocks.length
  const percent = Math.min(100, Math.round((placedCount / total) * 100))

  // 筛选今日应执行且未完成的在册习惯
  const pendingHabits = useMemo(() => {
    return habits
      .filter((h) => !h.archivedAt && isHabitDueOnDay(h, day))
      .filter((h) => !checkIns.some((c) => !c.deletedAt && c.habitId === h.id && c.date === day))
      .slice(0, 3)
  }, [habits, checkIns, day])

  function handleQuickCheckIn(habitId: string, habitName: string) {
    const res = checkIn(habitId)
    playSnapSound()
    playJellySound()
    if (res.complete) {
      playCelebrationSound()
      setToast(t.mini.toastComplete(getBlueprintName(blueprint.id, lang)))
    } else {
      setToast(t.mini.toastQuickCheckIn(habitName))
    }
    setTimeout(() => setToast(null), 1800)
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
      }}
    >
      {/* 顶部轻量拖拽栏 */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px 6px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg)',
          cursor: 'move',
        }}
      >
        <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src={logoUrl} alt="" width={16} height={16} />
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Rubik', sans-serif", color: 'var(--ink)' }}>BlockHabit</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="icon-btn"
            onClick={onExpand}
            title={t.mini.expandTooltip}
            style={{ width: 24, height: 24, borderRadius: 6 }}
          >
            <IconExpand size={13} />
          </button>
          <button
            className="icon-btn"
            onClick={onClose}
            title={t.mini.closeTooltip}
            style={{ width: 24, height: 24, borderRadius: 6 }}
          >
            <IconWinClose size={13} />
          </button>
        </div>
      </div>

      {/* 3D 迷你积木展示区 */}
      <div style={{ flex: 1, position: 'relative', background: 'var(--surface)' }}>
        <BuildScene blueprint={blueprint} placedCount={placedCount} />
      </div>

      {/* 底部紧凑打卡胶囊与进度 */}
      <div
        style={{
          padding: '8px 12px 10px',
          borderTop: '1px solid var(--line)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            marginBottom: 5,
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{getBlueprintName(blueprint.id, lang)}</span>
          <span style={{ color: 'var(--ink-2)' }}>
            {placedCount}/{total} ({percent}%)
          </span>
        </div>

        <div style={{ height: 3.5, background: 'var(--line)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
          <div
            style={{
              width: `${percent}%`,
              height: '100%',
              background: placedCount >= total ? 'var(--progress-green)' : 'var(--ink)',
              borderRadius: 999,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* 快捷打卡胶囊 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pendingHabits.length > 0 ? (
            pendingHabits.map((h) => (
              <button
                key={h.id}
                className="pill-action"
                style={{
                  fontSize: 11,
                  padding: '3px 9px',
                  background: 'color-mix(in srgb, var(--ink) 8%, transparent)',
                }}
                onClick={() => handleQuickCheckIn(h.id, h.name)}
                title={t.mini.habitCheckInTip(h.name)}
              >
                {h.name}
              </button>
            ))
          ) : (
            <div style={{ fontSize: 11, color: 'var(--progress-green)', fontWeight: 600, padding: '2px 0' }}>
              {t.mini.allDone}
            </div>
          )}
        </div>
      </div>

      {/* 浮动轻量 Toast */}
      {toast && (
        <div
          className="toast"
          style={{
            bottom: 44,
            fontSize: 11.5,
            padding: '5px 12px',
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
