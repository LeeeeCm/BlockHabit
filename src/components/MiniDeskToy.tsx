import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { useTimerStore } from '../store/timerStore'
import { useReminderStore, type PendingReminder } from '../store/reminderStore'
import { getBlueprint } from '../logic/blueprints'
import { habitMetOnDay, isHabitDueOnDay } from '../logic/checkin'
import { todayKey } from '../logic/dates'
import {
  effectiveTargetMs,
  MAX_EXTENSIONS,
  normalizeExtensions,
  viewFocusSessions,
  type FocusSessionLike
} from '../logic/focusSession'
import { petCheckInIntent, petPendingHabits, reminderIsCurrent } from '../logic/petActions'
import { resolvePetModel } from '../logic/petModels'
import { SNOOZE_MINUTES } from '../logic/reminderScheduler'
import {
  MINI_PRESETS,
  PET_SIDE_WIDTH,
  type MiniSize,
  type PetPanelLayout
} from '../platform/miniWindow'
import { useTodayKey } from '../logic/useTodayKey'
import { playCelebrationSound, playJellySound, playSnapSound } from '../audio/sound'
import { getBlueprintName, useI18n } from '../i18n'
import { triggerHaptic } from '../platform'
import { IconClose } from './Icons'
import { FocusPanel } from './minidesk/FocusPanel'
import { MiniFooter } from './minidesk/MiniFooter'
import { MiniHeader } from './minidesk/MiniHeader'
import { PetAvatar } from './minidesk/PetAvatar'
import { counterProgress, PetReminders, PetSidePanel } from './minidesk/PetPanels'
import { useFocusNow } from './minidesk/useFocusNow'
import './minidesk/petPanels.css'

interface Props {
  size: MiniSize
  pinned: boolean
  onTogglePin: () => void
  onExpand: () => void
  onClose: () => void
  onToday?: () => void
  onSettings?: () => void
  onPanelChange?: (open: boolean) => void
  panelArrangement?: PetPanelLayout['arrangement']
}

function currentReminder(item: PendingReminder, now = new Date()): boolean {
  const state = useAppStore.getState()
  return reminderIsCurrent(
    item,
    state.habits.find(({ id }) => id === item.habitId),
    state.checkIns,
    now,
    state.settings.remindersEnabled !== false,
    state.reminderLog?.[item.habitId]
  )
}

function makeFocusKey(id: string, session: FocusSessionLike): string {
  return `${id}:${session.startedAt}:${effectiveTargetMs(session)}`
}

/** D-20261124-081：桌宠和面板依赖同一个已水合的 store，提示动作从不隐式写打卡。 */
export function MiniDeskToy({
  size,
  pinned,
  onTogglePin,
  onExpand,
  onClose,
  onToday,
  onSettings,
  onPanelChange,
  panelArrangement
}: Props) {
  const { lang, t } = useI18n()
  const preset = MINI_PRESETS[size]
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const modelSetting = useAppStore((s) => s.settings.petModel)
  const remindersEnabled = useAppStore((s) => s.settings.remindersEnabled !== false)
  const reminderLog = useAppStore((s) => s.reminderLog)
  const sessions = useTimerStore((s) => s.sessions)
  const queued = useReminderStore((s) => s.pending)
  const suppressed = useReminderStore((s) => s.suppressed)
  const [toast, showToast] = useTransient<string>(1800)
  const [happy, showHappy] = useTransient<boolean>(1400)
  const [abandonKey, setAbandonKey] = useState<string | null>(null)
  const [dismissedFocusKeys, setDismissedFocusKeys] = useState<Record<string, string>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const avatarRef = useRef<HTMLButtonElement>(null)

  const day = useTodayKey()
  const blueprint = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const total = blueprint.blocks.length
  const dueCount = habits.filter((h) => !h.archivedAt && isHabitDueOnDay(h, day)).length
  const rows = useMemo(() => petPendingHabits(habits, checkIns, day), [habits, checkIns, day])
  const model = useMemo(() => resolvePetModel(modelSetting, builds), [modelSetting, builds])
  const focusSessions = useMemo(
    () =>
      Object.fromEntries(
        habits.flatMap((habit) => {
          const session = sessions[habit.id]
          return habit.kind === 'focus' && !habit.archivedAt && session ? [[habit.id, session]] : []
        })
      ),
    [habits, sessions]
  )
  // 专注会话继续在本地走时；「今天能否写入」单独计算，无权隐藏到点提示。
  const focus = viewFocusSessions(focusSessions, useFocusNow(Object.keys(focusSessions).length > 0))
  const wakeUp = focus.ordered.find(
    ({ id, view }) =>
      view.phase === 'ready' && dismissedFocusKeys[id] !== makeFocusKey(id, focusSessions[id])
  )
  const foreground =
    wakeUp ??
    (menuOpen ? focus.ordered[0] : focus.ordered.find(({ view }) => view.phase === 'focusing'))
  const focusHabit = habits.find(({ id }) => id === foreground?.id)
  const focusView = foreground?.view ?? null
  const focusSession = focusHabit ? focusSessions[focusHabit.id] : undefined
  const focusKey = focusHabit && focusSession ? makeFocusKey(focusHabit.id, focusSession) : null
  const ready = focusView?.phase === 'ready'
  const visibleReminders = queued.filter((item) =>
    reminderIsCurrent(
      item,
      rows.find(({ habit }) => habit.id === item.habitId)?.habit,
      checkIns,
      new Date(),
      remindersEnabled,
      reminderLog?.[item.habitId]
    )
  )

  function toggleMenu(open: boolean) {
    setMenuOpen(open)
    onPanelChange?.(open)
    if (!open) avatarRef.current?.focus()
  }

  function applyPetAction(id: string, reminder?: PendingReminder, confirmation?: FocusSessionLike) {
    const app = useAppStore.getState()
    const timer = useTimerStore.getState()
    const reminderState = useReminderStore.getState()
    const habit = app.habits.find((h) => h.id === id)
    if (reminder && (!reminderState.pending.includes(reminder) || !currentReminder(reminder))) {
      showToast(t.pet.staleAction)
      return
    }
    const intent = petCheckInIntent(
      habit,
      app.checkIns,
      day,
      todayKey(),
      Date.now(),
      timer.sessions[id],
      confirmation
    )
    if (!habit || intent.type === 'stale') {
      showToast(t.pet.staleAction)
      return
    }
    if (intent.type === 'start' || intent.type === 'show-focus') {
      if (intent.type === 'start') timer.start(id, intent.targetMs)
      if (intent.type === 'show-focus') setDismissedFocusKeys((prior) => ({ ...prior, [id]: '' }))
      if (reminder) reminderState.dismiss(id)
      return
    }
    const result = app.checkIn(id, intent.minutes, undefined, intent.delta)
    if (!result.checkInId) {
      showToast(t.pet.staleAction)
      return
    }
    if (confirmation) timer.cancel(id)
    const current = useAppStore.getState()
    const met = habitMetOnDay(habit, current.checkIns, day)
    if (met) {
      reminderState.dismiss(id)
      showHappy(true)
      triggerHaptic('medium')
    }
    playSnapSound()
    if (result.placed) playJellySound()
    if (result.complete) playCelebrationSound()
    showToast(
      result.complete
        ? t.mini.toastComplete(getBlueprintName(app.activeBlueprintId, lang))
        : result.placed
          ? t.mini.toastQuickCheckIn(habit.name)
          : habit.kind === 'counter'
            ? t.pet.recordedStep(habit.name, counterProgress(habit, current.checkIns, day))
            : t.today.checkedInToast(habit.name)
    )
  }

  function manageFocus(action: 'extend' | 'abandon') {
    const timer = useTimerStore.getState()
    if (!focusHabit || !focusSession || day !== todayKey()) return
    const current = timer.sessions[focusHabit.id]
    if (
      !current ||
      current.startedAt !== focusSession.startedAt ||
      effectiveTargetMs(current) !== effectiveTargetMs(focusSession)
    )
      return
    if (action === 'extend' && timer.extend(focusHabit.id)) triggerHaptic('light')
    if (action === 'abandon') {
      timer.cancel(focusHabit.id)
      triggerHaptic('light')
      showToast(t.focusCompanion.gaveUp)
    }
    setAbandonKey(null)
  }

  function snooze(item: PendingReminder) {
    const store = useReminderStore.getState()
    if (!store.pending.includes(item) || !currentReminder(item)) {
      showToast(t.pet.staleAction)
      return
    }
    if (!store.snooze(item.habitId, Date.now() + SNOOZE_MINUTES * 60_000)) {
      showToast(t.reminder.snoozeLimitToast)
      return
    }
    store.dismiss(item.habitId)
    showToast(t.reminder.snoozedToast(SNOOZE_MINUTES))
  }

  const focusCard =
    focusView && focusHabit && focusKey ? (
      <FocusPanel
        focusView={focusView}
        focusHabit={focusHabit}
        size={menuOpen ? 'pocket' : size}
        otherFocusCount={focus.otherCount}
        canConfirm={rows.some(({ habit, canRecord }) => habit.id === focusHabit.id && canRecord)}
        canExtend={Boolean(focusSession && normalizeExtensions(focusSession) < MAX_EXTENSIONS)}
        giveUpPending={abandonKey === `${focusKey}:${focusView.phase}`}
        onConfirm={() => {
          if (focusSession) applyPetAction(focusHabit.id, undefined, focusSession)
        }}
        onExtend={() => manageFocus('extend')}
        onRequestGiveUp={() => setAbandonKey(`${focusKey}:${focusView.phase}`)}
        onCancelGiveUp={() => setAbandonKey(null)}
        onAbandon={() => manageFocus('abandon')}
      />
    ) : null
  const showFocusBubble = ready
  const showReminderBubble =
    !menuOpen && !suppressed && visibleReminders.length > 0 && !showFocusBubble
  const activeFocusIds = new Set(focus.ordered.map(({ id }) => id))
  const reminderContent = (dismissible: boolean) => (
    <PetReminders
      reminders={visibleReminders}
      rows={rows}
      activeFocusIds={activeFocusIds}
      onRecord={applyPetAction}
      onSnooze={snooze}
      onDismiss={dismissible ? () => useReminderStore.getState().acknowledge() : undefined}
    />
  )

  return (
    <div
      className="pet-window"
      data-testid="mini-desk-toy"
      data-size={size}
      data-focus={focusCard ? 'active' : 'idle'}
      data-arrangement={menuOpen ? (panelArrangement ?? 'side') : undefined}
      style={{ '--pet-panel-width': `${PET_SIDE_WIDTH}px` } as CSSProperties}
      onKeyDown={(event) => {
        if (menuOpen && event.key === 'Escape') {
          event.preventDefault()
          toggleMenu(false)
        }
      }}
    >
      <div className="pet-column">
        <MiniHeader
          size={size}
          pinned={pinned}
          onTogglePin={onTogglePin}
          onExpand={onExpand}
          onClose={onClose}
          dragDisabled={menuOpen}
        />
        <div className="pet-stage">
          <PetAvatar
            model={model}
            mood={
              happy
                ? 'happy'
                : ready || visibleReminders.length > 0
                  ? 'ready'
                  : focusCard
                    ? 'focus'
                    : 'idle'
            }
            label={t.pet.menu(t.pet.modelNames[model])}
            menuOpen={menuOpen}
            onToggleMenu={() => toggleMenu(!menuOpen)}
            buttonRef={avatarRef}
          />
          <span className="pet-stage-hint" aria-hidden="true">
            {t.pet.menuHint}
          </span>
        </div>

        {!menuOpen && showFocusBubble ? (
          <section
            className="pet-bubble pet-focus-bubble"
            data-testid="pet-focus-bubble"
            aria-label={t.focusCompanion.ready}
            aria-live="polite"
          >
            <div className="pet-panel-heading">
              <button
                type="button"
                className="icon-btn pet-close"
                aria-label={t.pet.dismissReminder}
                onClick={() => {
                  if (focusHabit && focusKey) {
                    setDismissedFocusKeys((prior) => ({ ...prior, [focusHabit.id]: focusKey }))
                  }
                }}
              >
                <IconClose size={14} />
              </button>
            </div>
            {focusCard}
            {visibleReminders.length > 0 && (
              <button
                type="button"
                className="btn ghost pet-more-reminders"
                onClick={() => toggleMenu(true)}
              >
                {t.pet.moreReminders(visibleReminders.length)}
              </button>
            )}
          </section>
        ) : showReminderBubble ? (
          reminderContent(true)
        ) : !menuOpen && focusCard && !ready ? (
          <div
            className="pet-focus-holder"
            style={size !== 'pocket' ? { height: preset.footerH } : undefined}
          >
            {focusCard}
          </div>
        ) : (
          <MiniFooter
            size={size}
            blueprintId={blueprint.id}
            placedCount={placedCount}
            total={total}
            percent={total > 0 ? Math.min(100, Math.round((placedCount / total) * 100)) : 0}
            remaining={Math.max(0, total - placedCount)}
            activeHabitCount={dueCount}
            doneCount={dueCount - rows.length}
            pendingHabits={rows.slice(0, preset.maxPills)}
            onQuickCheckIn={(id) => applyPetAction(id)}
          />
        )}
      </div>
      {menuOpen && (
        <PetSidePanel
          rows={rows}
          dueCount={dueCount}
          checkIns={checkIns}
          day={day}
          pinned={pinned}
          activeFocusIds={activeFocusIds}
          prompts={
            <>
              {focusCard}
              {reminderContent(false)}
            </>
          }
          onRecord={(id) => applyPetAction(id)}
          onClose={() => toggleMenu(false)}
          onToday={onToday ?? onExpand}
          onSettings={onSettings}
          onTogglePin={onTogglePin}
          onHide={onClose}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
