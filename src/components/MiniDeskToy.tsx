import { useEffect, useMemo, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { useTimerStore } from '../store/timerStore'
import { getBlueprint } from '../logic/blueprints'
import { habitMetOnDay, isHabitDueOnDay } from '../logic/checkin'
import {
  MAX_EXTENSIONS,
  formatRemaining,
  normalizeExtensions,
  primarySessionId,
  viewSession,
  type FocusView,
} from '../logic/focusSession'
import { MINI_PRESETS, type MiniSize } from '../platform/miniWindow'
import { useTodayKey } from '../logic/useTodayKey'
import { BuildScene } from '../render/BuildScene'
import { playCelebrationSound, playJellySound, playSnapSound } from '../audio/sound'
import { getBlueprintName, useI18n } from '../i18n'
import { triggerHaptic } from '../platform'
import { IconCheck, IconClose, IconExpand, IconPin, IconWinClose } from './Icons'
import logoUrl from '../assets/logo-mark.svg'

interface Props {
  /** 三档尺寸（D-20261110-059）：口袋 / 标准 / 展台 */
  size: MiniSize
  pinned: boolean
  onTogglePin: () => void
  onExpand: () => void
  onClose: () => void
}

/** 专注会话存在时的地与本位时钟（500ms 心跳，只驱动摆件自身的倒计时） */
function useFocusNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

/** 环形进度（B2）：SVG 描边进度，不用渐变/阴影，reduced-motion 下时长令牌自动归零 */
function FocusRing({ progress, size, label }: { progress: number; size: number; label: string }) {
  const stroke = size >= 64 ? 5 : 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(1, progress))
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden="true">
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'}
          style={{ transition: 'stroke-dashoffset var(--dur-lg) var(--ease-default)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size >= 64 ? 'var(--fs-small)' : 'var(--fs-caption)',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--ink)',
        }}
      >
        {label}
      </div>
    </div>
  )
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

  // —— 专注态：取最早到点的会话；过期/习惯已删的会话不显示（由 App 的 TimerWatcher prune） ——
  const focusNow = useFocusNow(Object.keys(sessions).length > 0)
  const focusHabitId = primarySessionId(sessions, focusNow)
  const focusSession = focusHabitId ? sessions[focusHabitId] : null
  const focusHabit = focusHabitId ? habits.find((h) => h.id === focusHabitId && !h.archivedAt) : undefined
  const focusView: FocusView | null = focusSession ? viewSession(focusSession, focusNow) : null
  const focusActive = Boolean(focusHabit && focusView && focusView.phase !== 'expired')
  const canExtend = focusSession ? normalizeExtensions(focusSession) < MAX_EXTENSIONS : false

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
      1800,
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

  const controlSize = 32
  const iconBtnStyle = { width: controlSize, height: controlSize, borderRadius: 7, flexShrink: 0 }
  const stageStyle = { flex: 1, position: 'relative' as const, minHeight: 0, background: 'var(--surface)' }

  /** 专注面板：口袋档纵向铺满内容区；标准/展台档占底部固定高度（三档都不裁切） */
  function renderFocusPanel() {
    if (!focusView || !focusHabit) return null
    const focusing = focusView.phase === 'focusing'
    const remainingText = formatRemaining(focusView.remainingMs)
    const ringSize = size === 'display' ? 72 : 56
    const ringLabel = focusing ? remainingText : '100%'

    if (compact) {
      return (
        <div
          data-testid="focus-panel"
          data-focus-phase={focusView.phase}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                fontWeight: 700,
                color: 'var(--ink)',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {focusHabit.name}
            </span>
            {focusing && !giveUpPending && (
              <button
                className="btn ghost"
                onClick={() => setGiveUpPending(true)}
                title={t.focusCompanion.giveUp}
                style={{ flexShrink: 0, padding: '2px 6px', minHeight: 24, fontSize: 'var(--fs-caption)' }}
              >
                {t.focusCompanion.giveUp}
              </button>
            )}
          </div>

          {giveUpPending ? (
            <>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--danger)', lineHeight: 1.35 }}>
                {t.focusCompanion.giveUpConfirm}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn ghost"
                  onClick={() => setGiveUpPending(false)}
                  style={{ flex: 1, minHeight: 30, padding: '2px 6px', fontSize: 'var(--fs-caption)' }}
                >
                  {t.common.cancel}
                </button>
                <button
                  className="btn primary"
                  onClick={abandonFocus}
                  style={{ flex: 1, minHeight: 30, padding: '2px 6px', fontSize: 'var(--fs-caption)' }}
                >
                  {t.focusCompanion.giveUp}
                </button>
              </div>
            </>
          ) : focusing ? (
            <>
              <div
                style={{
                  fontSize: 'var(--fs-hero)',
                  fontWeight: 700,
                  lineHeight: 1.05,
                  fontFamily: "'Rubik', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--ink)',
                }}
              >
                {remainingText}
              </div>
              <div style={{ height: 3, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    width: Math.round(focusView.progress * 100) + '%',
                    height: '100%',
                    background: 'var(--ink)',
                    borderRadius: 999,
                    transition: 'width var(--dur-lg) var(--ease-default)',
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', lineHeight: 1.35 }}>
                {t.focusCompanion.ready}
              </div>
              <button
                className="btn primary"
                onClick={confirmFocusCheckIn}
                style={{ minHeight: 30, padding: '2px 8px', fontSize: 'var(--fs-caption)', flexShrink: 0 }}
              >
                {t.focusCompanion.confirmCheckIn}
              </button>
              <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
                {canExtend && (
                  <button
                    className="btn ghost"
                    onClick={extendFocus}
                    style={{ flex: 1, minWidth: 0, minHeight: 26, padding: '2px 6px', fontSize: 'var(--fs-caption)' }}
                  >
                    {t.focusCompanion.extendFive}
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() => setGiveUpPending(true)}
                  style={{ flex: 1, minWidth: 0, minHeight: 26, padding: '2px 6px', fontSize: 'var(--fs-caption)' }}
                >
                  {t.focusCompanion.giveUp}
                </button>
              </div>
            </>
          )}
        </div>
      )
    }

    return (
      <div
        data-testid="focus-panel"
        data-focus-phase={focusView.phase}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 6,
          padding: compact ? '5px 8px 7px' : '8px 12px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 0 }}>
          <FocusRing progress={focusing ? focusView.progress : 1} size={ringSize} label={ringLabel} />
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 'var(--fs-body)',
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {focusHabit.name}
            </span>
            <span
              style={{
                fontSize: 'var(--fs-caption)',
                color: 'var(--ink-2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {focusing ? t.focusCompanion.focusing : t.focusCompanion.ready}
            </span>
            {size === 'display' && (
              <span
                style={{
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--ink-2)',
                  opacity: 0.75,
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {t.focusCompanion.persistedHint}
              </span>
            )}
          </div>
          {!giveUpPending && (
            <button
              className="icon-btn"
              onClick={() => setGiveUpPending(true)}
              title={t.focusCompanion.giveUp}
              aria-label={t.focusCompanion.giveUp}
              style={{ flexShrink: 0, width: 30, height: 28, borderRadius: 7 }}
            >
              <IconClose size={13} />
            </button>
          )}
        </div>

        {giveUpPending ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, minHeight: 44 }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 'var(--fs-caption)',
                color: 'var(--danger)',
                lineHeight: 1.35,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {t.focusCompanion.giveUpConfirm}
            </span>
            <button
              className="btn ghost"
              onClick={() => setGiveUpPending(false)}
              style={{ flexShrink: 0, minHeight: 32, padding: '2px 10px', fontSize: 'var(--fs-caption)' }}
            >
              {t.common.cancel}
            </button>
            <button
              className="btn primary"
              onClick={abandonFocus}
              style={{ flexShrink: 0, minHeight: 32, padding: '2px 10px', fontSize: 'var(--fs-caption)' }}
            >
              {t.focusCompanion.giveUp}
            </button>
          </div>
        ) : focusing ? (
          <div style={{ height: 3, background: 'var(--line)', borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
            <div
              style={{
                width: Math.round(focusView.progress * 100) + '%',
                height: '100%',
                background: 'var(--ink)',
                borderRadius: 999,
                transition: 'width var(--dur-lg) var(--ease-default)',
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, minWidth: 0, flexShrink: 0 }}>
            <button
              className="btn primary"
              onClick={confirmFocusCheckIn}
              style={{ flex: 1, minWidth: 0, minHeight: 32, padding: '2px 10px', fontSize: 'var(--fs-caption)' }}
            >
              {t.focusCompanion.confirmCheckIn}
            </button>
            {canExtend && (
              <button
                className="btn ghost"
                onClick={extendFocus}
                style={{ flex: 1, minWidth: 0, minHeight: 32, padding: '2px 8px', fontSize: 'var(--fs-caption)' }}
              >
                {t.focusCompanion.extendFive}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

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
        boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
      }}
    >
      {/* 顶部轻量拖拽栏（双击展开主窗） */}
      <div
        data-tauri-drag-region
        onDoubleClick={onExpand}
        title={t.mini.doubleClickHint}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          padding: compact ? '2px 6px' : '2px 8px',
          height: preset.headerH,
          flexShrink: 0,
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg)',
          cursor: 'move',
        }}
      >
        <div data-tauri-drag-region style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <img src={logoUrl} alt="" width={compact ? 12 : 14} height={compact ? 12 : 14} />
          <span
            data-tauri-drag-region
            style={{
              fontSize: compact ? 'var(--fs-caption)' : 'var(--fs-small)',
              fontWeight: 700,
              fontFamily: "'Rubik', sans-serif",
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            BlockHabit
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <button
            className="icon-btn"
            onClick={onTogglePin}
            title={t.settings.miniAlwaysOnTopLabel}
            aria-label={t.settings.miniAlwaysOnTopLabel}
            style={iconBtnStyle}
          >
            <IconPin size={compact ? 12 : 14} pinned={pinned} />
          </button>
          <button className="icon-btn" onClick={onExpand} title={t.mini.expandTooltip} style={iconBtnStyle}>
            <IconExpand size={compact ? 12 : 14} />
          </button>
          <button className="icon-btn" onClick={onClose} title={t.mini.closeTooltip} style={iconBtnStyle}>
            <IconWinClose size={compact ? 12 : 14} />
          </button>
        </div>
      </div>

      {focusActive ? (
        compact ? (
          renderFocusPanel()
        ) : (
          <>
            <div style={stageStyle}>
              <BuildScene blueprint={blueprint} placedCount={placedCount} animateIndex={justPlacedIndex} />
            </div>
            <div
              style={{
                height: preset.footerH,
                flexShrink: 0,
                borderTop: '1px solid var(--line)',
                background: 'var(--bg)',
                overflow: 'hidden',
              }}
            >
              {renderFocusPanel()}
            </div>
          </>
        )
      ) : (
        <>
          {/* 3D 迷你积木展示区 */}
          <div style={stageStyle}>
            <BuildScene blueprint={blueprint} placedCount={placedCount} animateIndex={justPlacedIndex} />
          </div>

          {/* 底部：按尺寸档切换信息密度 */}
          <div
            style={{
              padding: compact ? '5px 8px 7px' : '8px 12px 10px',
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
                gap: 6,
                fontSize: 'var(--fs-caption)',
                marginBottom: 4,
              }}
            >
              {!compact && (
                <span style={{ fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getBlueprintName(blueprint.id, lang)}
                </span>
              )}
              <span style={{ color: 'var(--ink-2)', flexShrink: 0, marginLeft: compact ? 'auto' : 0 }}>
                {preset.showProgressText
                  ? placedCount + '/' + total + ' (' + percent + '%)'
                  : t.mini.nextMilestone(getBlueprintName(blueprint.id, lang), remaining)}
              </span>
            </div>

            <div style={{ height: 3, background: 'var(--line)', borderRadius: 999, overflow: 'hidden', marginBottom: compact ? 5 : 8 }}>
              <div
                style={{
                  width: percent + '%',
                  height: '100%',
                  background: placedCount >= total ? 'var(--progress-green)' : 'var(--ink)',
                  borderRadius: 999,
                  transition: 'width var(--dur-lg) var(--ease-default)',
                }}
              />
            </div>

            {preset.showTodayList ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 96, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginBottom: 2 }}>
                  <span>{t.mini.todayLabel}</span>
                  <span>
                    {doneCount}/{activeHabits.length}
                  </span>
                </div>
                {pendingHabits.length > 0 ? (
                  pendingHabits.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleQuickCheckIn(h.id, h.name)}
                      title={t.mini.habitCheckInTip(h.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        padding: '4px 6px',
                        minHeight: 32,
                        borderRadius: 'var(--r-sm)',
                        background: 'transparent',
                        color: 'var(--ink)',
                        fontSize: 'var(--fs-caption)',
                        textAlign: 'left',
                      }}
                    >
                      <IconCheck size={12} style={{ color: 'var(--ink-3, var(--ink-2))', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                    </button>
                  ))
                ) : (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--progress-green)', fontWeight: 600, padding: '2px 0' }}>
                    {t.mini.allDone}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pendingHabits.length > 0 ? (
                  pendingHabits.map((h) => (
                    <button
                      key={h.id}
                      className="pill-action"
                      style={{
                        fontSize: 'var(--fs-caption)',
                        padding: '4px 10px',
                        minHeight: 32,
                        background: 'color-mix(in srgb, var(--ink) 8%, transparent)',
                      }}
                      onClick={() => handleQuickCheckIn(h.id, h.name)}
                      title={t.mini.habitCheckInTip(h.name)}
                    >
                      {h.name}
                    </button>
                  ))
                ) : (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--progress-green)', fontWeight: 600, padding: '2px 0' }}>
                    {t.mini.allDone}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="toast" style={{ bottom: compact ? 8 : 44, fontSize: 'var(--fs-small)', padding: '5px 12px', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
