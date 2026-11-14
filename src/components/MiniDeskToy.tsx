import { useEffect, useMemo, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { useTimerStore } from '../store/timerStore'
import { getBlueprint } from '../logic/blueprints'
import { habitMetOnDay, isHabitDueOnDay } from '../logic/checkin'
import {
  MAX_EXTENSIONS,
  normalizeExtensions,
  viewFocusSessions,
  type FocusView
} from '../logic/focusSession'
import { MINI_PRESETS, type MiniSize } from '../platform/miniWindow'
import { useTodayKey } from '../logic/useTodayKey'
import { playCelebrationSound, playJellySound, playSnapSound } from '../audio/sound'
import { getBlueprintName, useI18n } from '../i18n'
import { triggerHaptic } from '../platform'
import { FocusPanel } from './minidesk/FocusPanel'
import { MiniFooter } from './minidesk/MiniFooter'
import { MiniHeader } from './minidesk/MiniHeader'
import { MiniStage } from './minidesk/MiniStage'
import { useFocusNow } from './minidesk/useFocusNow'

interface Props {
  /** 三档尺寸（D-20261110-059）：口袋 / 标准 / 展台 */
  size: MiniSize
  pinned: boolean
  onTogglePin: () => void
  onExpand: () => void
  onClose: () => void
}

/**
 * 桌面灵动摆件 / 迷你伴侣小窗（Mini Desk Toy）：
 *
 * 两种形态共用一份数据：
 * - 日常：口袋（进度 + 1 快捷打卡）、标准（3D + 3 快捷打卡）、展台（3D + 今日清单）；
 * - 专注（B2 / D-20261110-064）：显示 timerStore 里的会话（绝对时间，重开恢复）——
 *   focusing 倒计时 + 环形进度；ready 由用户「确认落块」或「再等 5 分钟」；放弃需二次确认且不打卡。
 *   摆件只显示自己启动的计时，不做任何监控/阻断。
 */
export function MiniDeskToy({ size, pinned, onTogglePin, onExpand, onClose }: Props) {
  const { lang, t } = useI18n()
  const preset = MINI_PRESETS[size]
  const compact = size === 'pocket'
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const checkIn = useAppStore((s) => s.checkIn)
  const sessions = useTimerStore((s) => s.sessions)
  const extendTimer = useTimerStore((s) => s.extend)
  const cancelTimer = useTimerStore((s) => s.cancel)
  const [toast, showToast] = useTransient<string>(1800)
  const [giveUpPending, setGiveUpPending] = useState(false)
  const [justPlacedIndex, setJustPlacedIndex] = useState<number | null>(null)

  const day = useTodayKey()
  const blueprint = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const total = blueprint.blocks.length
  const percent = Math.min(100, Math.round((placedCount / total) * 100))
  const remaining = Math.max(0, total - placedCount)
  const activeHabits = habits.filter((h) => !h.archivedAt)
  const doneCount = activeHabits.filter((h) => habitMetOnDay(h, checkIns, day)).length

  // —— 专注态：主面板显示 viewFocusSessions 的主会话（ready 优先，其次最早到点）；
  // 过期/习惯已删的会话不显示（由 App 的 TimerWatcher prune）。
  const focusNow = useFocusNow(Object.keys(sessions).length > 0)
  const focusSessionsView = viewFocusSessions(sessions, focusNow)
  const focusHabitId = focusSessionsView.primaryId
  const focusSession = focusHabitId ? sessions[focusHabitId] : null
  const focusHabit = focusHabitId
    ? habits.find((h) => h.id === focusHabitId && !h.archivedAt)
    : undefined
  const focusView: FocusView | null = focusSessionsView.ordered[0]?.view ?? null
  const focusActive = Boolean(focusHabit && focusView && focusView.phase !== 'expired')
  const canExtend = focusSession ? normalizeExtensions(focusSession) < MAX_EXTENSIONS : false
  // B4：主面板之外仍有会话时在副行提示「另有 N 个专注」，避免两个会话时另一个被完全藏起来
  const otherFocusCount = focusActive ? focusSessionsView.otherCount : 0

  useEffect(() => {
    setGiveUpPending(false)
  }, [focusHabitId, focusView?.phase])

  useEffect(() => {
    if (justPlacedIndex === null) return
    const timer = window.setTimeout(() => setJustPlacedIndex(null), 1400)
    return () => window.clearTimeout(timer)
  }, [justPlacedIndex])

  // 今日应执行且未达标的习惯（与今日页同一判定口径）
  const pendingHabits = useMemo(() => {
    return activeHabits
      .filter((h) => isHabitDueOnDay(h, day) && !habitMetOnDay(h, checkIns, day))
      .slice(0, preset.maxPills)
  }, [activeHabits, checkIns, day, preset.maxPills])

  function handleQuickCheckIn(habitId: string, habitName: string) {
    const res = checkIn(habitId)
    playSnapSound()
    playJellySound()
    if (res.complete) {
      playCelebrationSound()
      showToast(t.mini.toastComplete(getBlueprintName(blueprint.id, lang)), 1800)
    } else {
      showToast(t.mini.toastQuickCheckIn(habitName), 1800)
    }
  }

  /** 到点确认：只有用户点「确认落块」才真正 checkIn（绝不自动完成） */
  function confirmFocusCheckIn() {
    if (!focusHabit || !focusView) return
    const habitName = focusHabit.name
    const res = checkIn(focusHabit.id, focusView.actualMinutes)
    cancelTimer(focusHabit.id)
    setGiveUpPending(false)
    if (res.reason) {
      if (res.reason === 'already') showToast(t.today.checkedInToast(habitName), 1800)
      return
    }
    triggerHaptic('medium')
    playSnapSound()
    playJellySound()
    if (res.complete) playCelebrationSound()
    // 新落下的块在蓝图里的序位 = checkIn 之前的 placedCount（BuildScene 据此播掉落动画）
    setJustPlacedIndex(placedCount)
    showToast(
      res.complete
        ? t.mini.toastComplete(getBlueprintName(blueprint.id, lang))
        : t.mini.toastQuickCheckIn(habitName),
      1800
    )
  }

  /** 再等 5 分钟：延长会清空 notifiedAt，新目标到点会再提醒一次（上限 2 次） */
  function extendFocus() {
    if (!focusHabit) return
    const ok = extendTimer(focusHabit.id)
    if (!ok) return
    triggerHaptic('light')
    setGiveUpPending(false)
  }

  /** 放弃：二次确认后清除会话，不产生任何打卡 */
  function abandonFocus() {
    if (!focusHabit) return
    cancelTimer(focusHabit.id)
    setGiveUpPending(false)
    triggerHaptic('light')
    showToast(t.focusCompanion.gaveUp, 1800)
  }

  const focusPanel = (
    <FocusPanel
      focusView={focusView}
      focusHabit={focusHabit}
      size={size}
      otherFocusCount={otherFocusCount}
      canExtend={canExtend}
      giveUpPending={giveUpPending}
      onConfirm={confirmFocusCheckIn}
      onExtend={extendFocus}
      onRequestGiveUp={() => setGiveUpPending(true)}
      onCancelGiveUp={() => setGiveUpPending(false)}
      onAbandon={abandonFocus}
    />
  )

  return (
    <div
      data-testid="mini-desk-toy"
      data-size={size}
      data-focus={focusActive ? 'active' : 'idle'}
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
        boxShadow: '0 12px 36px rgba(0,0,0,0.18)'
      }}
    >
      <MiniHeader
        size={size}
        pinned={pinned}
        onTogglePin={onTogglePin}
        onExpand={onExpand}
        onClose={onClose}
      />

      {focusActive ? (
        compact ? (
          focusPanel
        ) : (
          <>
            <MiniStage
              blueprint={blueprint}
              placedCount={placedCount}
              animateIndex={justPlacedIndex}
            />
            <div
              style={{
                height: preset.footerH,
                flexShrink: 0,
                borderTop: '1px solid var(--line)',
                background: 'var(--bg)',
                overflow: 'hidden'
              }}
            >
              {focusPanel}
            </div>
          </>
        )
      ) : (
        <>
          {/* 3D 迷你积木展示区 */}
          <MiniStage
            blueprint={blueprint}
            placedCount={placedCount}
            animateIndex={justPlacedIndex}
          />

          <MiniFooter
            size={size}
            blueprintId={blueprint.id}
            placedCount={placedCount}
            total={total}
            percent={percent}
            remaining={remaining}
            activeHabitCount={activeHabits.length}
            doneCount={doneCount}
            pendingHabits={pendingHabits}
            onQuickCheckIn={handleQuickCheckIn}
          />
        </>
      )}

      {toast && (
        <div
          className="toast"
          style={{
            bottom: compact ? 8 : 44,
            fontSize: 'var(--fs-small)',
            padding: '5px 12px',
            whiteSpace: 'nowrap'
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
