import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import type { CheckInResult, Habit, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { useReminderStore } from '../store/reminderStore'
import { useTimerStore } from '../store/timerStore'
import { useTodayKey } from '../logic/useTodayKey'
import { canCheckInHabit, habitMetOnDay } from '../logic/checkin'
import { noBlockReason } from '../logic/blockHints'
import { buildTodayBrief } from '../logic/todayBrief'
import { templateFrequency, type HabitTemplate } from '../logic/habitTemplates'
import { getNudgeConsent, setNudgeConsent, type NudgeConsent } from '../platform/eveningNudgePrefs'
import { TodayBrief } from '../components/TodayBrief'
import { EveningNudgeConsent } from '../components/EveningNudgeConsent'
import { blueprintOrder, getBlueprint } from '../logic/blueprints'
import { useI18n } from '../i18n'
import { playCelebrationSound } from '../audio/sound'
import { triggerHaptic, usePlatform } from '../platform'
import { ensureNotifyPermission } from '../platform/notify'
import {
  PERIOD_ORDER,
  focusHabitCard,
  type DropModalState,
  type TodayToast
} from './today/todayUtils'
import { TodayHeader } from './today/TodayHeader'
import { TodayFocusEntry } from './today/TodayFocusEntry'
import { TodayCategoryFilter } from './today/TodayCategoryFilter'
import { TodayFullDayCard } from './today/TodayFullDayCard'
import { TodayEchoCapsule } from './today/TodayEchoCapsule'
import { TodayReminderBanner } from './today/TodayReminderBanner'
import { TodayEmptyState } from './today/TodayEmptyState'
import { TodayHabitSections } from './today/TodayHabitSections'
import { TodayArchiveSection } from './today/TodayArchiveSection'
import { TodayOverlays } from './today/TodayOverlays'

interface Props {
  onCelebrate?: () => void
  /** F1：首启引导里「看看建造页」的跳转（由 App 提供） */
  onGoBuild?: () => void
  /** 提醒「开始打卡」跳转过来时待高亮的习惯 id（消费后回调清空） */
  focusHabitId?: string | null
  onFocusConsumed?: () => void
}

export default function Today({ onCelebrate, onGoBuild, focusHabitId, onFocusConsumed }: Props) {
  const { t } = useI18n()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const dayClaims = useAppStore((s) => s.dayClaims)
  const checkInDay = useAppStore((s) => s.checkInDay)
  const completedBlueprintIds = useAppStore((s) => s.completedBlueprintIds)
  const restoreHabit = useAppStore((s) => s.restoreHabit)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const enableGentleDecay = useAppStore((s) => s.settings.enableGentleDecay !== false)
  const addHabit = useAppStore((s) => s.addHabit)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const nudgeEnabled = useAppStore((s) => s.settings.eveningNudgeEnabled === true)
  const pendingReminders = useReminderStore((s) => s.pending)
  const reopenReminders = useReminderStore((s) => s.reopen)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [nudgeConsent, setNudgeConsentState] = useState<NudgeConsent | null>(() =>
    getNudgeConsent()
  )
  const [toast, setTransientToast] = useTransient<TodayToast>(2400)
  const [showArchive, setShowArchive] = useState(false)
  const [archDelete, setArchDelete] = useState<Habit | null>(null)
  const [dropModal, setDropModal] = useState<DropModalState | null>(null)
  // 「今天」由统一 hook 驱动：10s 轮询 + 聚焦/可见性刷新（跨午夜翻转）
  const day = useTodayKey()
  const [now, setNow] = useState(() => new Date())
  // 问候语只依赖小时：每分钟检查一次，只有跨小时才触发重渲染（避免整页每分钟刷新）
  useEffect(() => {
    const timer = setInterval(() => {
      setNow((prev) => {
        const next = new Date()
        return next.getHours() === prev.getHours() ? prev : next
      })
    }, 60_000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    setNow(new Date())
  }, [day])
  // memo 化：下游 categories/filteredActive/metCount/grouped 的 useMemo 依赖此引用
  const active = useMemo(() => habits.filter((h) => !h.archivedAt), [habits])
  const archived = habits.filter((h) => h.archivedAt)
  const blueprint = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const total = blueprint.blocks.length
  const percent = Math.min(100, Math.round((placedCount / total) * 100))
  const placedCountRef = useRef(placedCount)
  placedCountRef.current = placedCount

  const categories = useMemo(() => {
    const list: string[] = []
    for (const h of active) {
      if (h.category?.trim() && !list.includes(h.category.trim())) {
        list.push(h.category.trim())
      }
    }
    return list
  }, [active])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  const filteredActive = useMemo(() => {
    if (!selectedCat) return active
    return active.filter((h) => h.category === selectedCat)
  }, [active, selectedCat])
  const metCount = useMemo(
    () => active.filter((h) => habitMetOnDay(h, checkIns, day)).length,
    [active, checkIns, day]
  )

  const grouped = useMemo(() => {
    const g = new Map<HabitPeriod, Habit[]>()
    for (const p of PERIOD_ORDER) g.set(p, [])
    const sorted = [...filteredActive].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return 0
    })
    for (const h of sorted) g.get(h.period ?? 'any')!.push(h)
    return g
  }, [filteredActive])

  const brief = useMemo(
    () =>
      buildTodayBrief({
        now,
        day,
        habits,
        checkIns,
        builds,
        activeBlueprintId,
        targetHabits: filteredActive,
        completedBlueprintIds
      }),
    [now, day, habits, checkIns, builds, activeBlueprintId, filteredActive, completedBlueprintIds]
  )
  const hasAnyCheckIn = useMemo(() => checkIns.some((c) => !c.deletedAt), [checkIns])

  const echoEntry = useMemo(() => {
    const candidates = checkIns.filter((c) => !c.deletedAt && c.date < day && c.note?.trim())
    if (candidates.length === 0) return null
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    )
    return candidates[dayOfYear % candidates.length]
  }, [checkIns, day])

  const echoDaysAgo = useMemo(() => {
    if (!echoEntry) return 0
    const todayMs = new Date(day + 'T00:00:00').getTime()
    const entryMs = new Date(echoEntry.date + 'T00:00:00').getTime()
    return Math.max(1, Math.round((todayMs - entryMs) / 86400000))
  }, [echoEntry, day])

  // B4：今日页专注入口 —— 有可开始的专注习惯且当前无任何会话时出现；启动复用 HabitRow 的同一个 timerStore.start
  const { isMobile } = usePlatform()
  const focusSessions = useTimerStore((s) => s.sessions)
  const startTimer = useTimerStore((s) => s.start)
  const focusStartHabit =
    Object.keys(focusSessions).length > 0
      ? null
      : (filteredActive.find(
          (h) =>
            h.kind === 'focus' && Boolean(h.targetMinutes) && canCheckInHabit(h, checkIns, day).ok
        ) ?? null)

  // 仍待处理的到点提醒（打卡/跳过/移除提醒后自动从横幅消失，与调度器剪枝同口径）
  const activeReminders = useMemo(
    () =>
      pendingReminders.filter((item) => {
        const h = habits.find((x) => x.id === item.habitId)
        return h !== undefined && !h.archivedAt && !habitMetOnDay(h, checkIns, day)
      }),
    [pendingReminders, habits, checkIns, day]
  )

  // 提醒「开始打卡」跳转：滚动到该习惯卡片并脉冲高亮
  const focusConsumedRef = useRef(onFocusConsumed)
  focusConsumedRef.current = onFocusConsumed
  useEffect(() => {
    if (!focusHabitId) return
    focusHabitCard(focusHabitId)
    focusConsumedRef.current?.()
  }, [focusHabitId])
  function showToast(text: string, accent = false) {
    setTransientToast({ text, accent }, 2400)
  }

  const handleStartFirst = useCallback(() => {
    triggerHaptic('selection')
    focusHabitCard(brief.firstPendingHabitId)
  }, [brief.firstPendingHabitId])

  const handleTemplatePick = useCallback(
    (template: HabitTemplate) => {
      triggerHaptic('light')
      const name = t.templates[template.id]
      addHabit(name, templateFrequency(), { period: template.period })
      showToast(t.templates.created(name), true)
    },
    [t, addHabit]
  )

  const handleNudgeEnable = useCallback(() => {
    triggerHaptic('light')
    setNudgeConsent('enabled')
    setNudgeConsentState('enabled')
    updateSettings({ eveningNudgeEnabled: true, eveningNudgeTime: '21:00' })
    // 在用户点「开启提醒」的当下申请系统通知权限，避免 21:00 突然弹权限框
    void ensureNotifyPermission()
    showToast(t.eveningNudge.enabledToast, true)
  }, [t, updateSettings])

  const handleNudgeDecline = useCallback(() => {
    setNudgeConsent('declined')
    setNudgeConsentState('declined')
  }, [])

  const handleHabitCheck = useCallback(
    (res: CheckInResult, h: Habit) => {
      if (res.complete) {
        setDropModal({
          habitName: h.name,
          placedCount: placedCountRef.current + 1,
          complete: true,
          checkInId: res.checkInId
        })
        playCelebrationSound()
      } else if (res.placed) {
        setDropModal({
          habitName: h.name,
          placedCount: placedCountRef.current + 1,
          complete: false,
          checkInId: res.checkInId
        })
      } else {
        // F2：没有掉块时必须说清原因，而不是让用户以为「积木丢了」。
        // 判别规则抽到 pure logic（logic/blockHints）以便单测；这里只负责选文案。
        const reason = noBlockReason({
          completedBlueprints: completedBlueprintIds.length,
          blueprintTotal: blueprintOrder.length,
          placedCount: placedCountRef.current,
          activeBlueprintBlocks: getBlueprint(activeBlueprintId).blocks.length
        })
        showToast(
          reason === 'all-blueprints-complete'
            ? t.today.allBlueprintsDone
            : reason === 'active-blueprint-complete'
              ? t.today.activeCompleteNoBlock
              : t.today.checkedInToast(h.name),
          reason !== 'normal'
        )
      }
      // B1：连击每满 7 天掉落的积木是点缀色奖励块 —— 让用户知道这块为什么不一样
      if (res.bonus) showToast(t.today.streakBonusToast(7), true)
    },
    [t, completedBlueprintIds, activeBlueprintId]
  )

  const handleEdit = useCallback((h: Habit) => {
    setEditing(h)
    setDialogOpen(true)
  }, [])

  const handleNoteSaved = useCallback(() => {
    showToast(t.reflections.engravedToast, true)
  }, [t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setEditing(null)
        setDialogOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** 打开「新建习惯」表单（头部与空态入口共用；Ctrl+N 走自己的快捷键监听） */
  function handleNewHabit() {
    setEditing(null)
    setDialogOpen(true)
  }

  /** 专注入口启动会话：会话状态在 timerStore，今日页只负责启动与反馈文案 */
  function handleStartFocus(habit: Habit) {
    startTimer(habit.id, (habit.targetMinutes ?? 25) * 60_000)
    showToast(t.focusCompanion.focusing)
  }

  /** 全勤领取：成功才庆祝；失败按 reason 给出可读原因（原内联逻辑，事件处理顺序不变） */
  function handleClaimDay() {
    const res = checkInDay()
    if (res.reason) {
      triggerHaptic('light')
      const failText =
        res.reason === 'incomplete'
          ? t.today.fullCard.claimFailIncomplete
          : res.reason === 'already'
            ? t.today.fullCard.claimFailAlready
            : t.today.fullCard.claimFailNoHabits
      showToast(failText, false)
      return
    }
    playCelebrationSound()
    showToast(
      res.bonus
        ? `${t.today.fullCard.claimToast} ${t.today.fullCard.claimBonusToast}`
        : t.today.fullCard.claimToast,
      true
    )
    if (res.complete) {
      setDropModal({
        habitName: t.today.fullCard.bonusHabitName,
        placedCount: placedCount + 1,
        complete: true
      })
    }
  }

  /** 归档区删除确认：先删数据再关确认框（与原内联 onConfirm 顺序一致） */
  function handleConfirmDeleteArchived() {
    if (!archDelete) return
    deleteHabit(archDelete.id)
    setArchDelete(null)
  }

  /** 积木掉落弹窗关闭：全勤完成的弹窗关闭后跳建造页庆祝 */
  function handleCloseDropModal() {
    if (!dropModal) return
    const wasComplete = dropModal.complete
    setDropModal(null)
    if (wasComplete) onCelebrate?.()
  }

  return (
    <div
      className="today-page-container"
      style={{ padding: '24px 24px 80px', maxWidth: 720, margin: '0 auto' }}
    >
      <TodayHeader
        now={now}
        blueprintId={blueprint.id}
        placedCount={placedCount}
        total={total}
        percent={percent}
        metCount={metCount}
        activeCount={active.length}
        onCelebrate={onCelebrate}
        onNewHabit={handleNewHabit}
      />

      {brief.show && <TodayBrief brief={brief} onStartFirst={handleStartFirst} />}

      {focusStartHabit && (
        <TodayFocusEntry
          habit={focusStartHabit}
          isMobile={isMobile}
          onStart={() => handleStartFocus(focusStartHabit)}
        />
      )}
      {hasAnyCheckIn && nudgeConsent === null && !nudgeEnabled && (
        <EveningNudgeConsent onEnable={handleNudgeEnable} onDecline={handleNudgeDecline} />
      )}

      {categories.length > 0 && (
        <TodayCategoryFilter
          categories={categories}
          activeHabits={active}
          selectedCat={selectedCat}
          onSelectAll={() => setSelectedCat(null)}
          onToggleCategory={(category) =>
            setSelectedCat((curr) => (curr === category ? null : category))
          }
        />
      )}

      {metCount === active.length && active.length > 0 && (
        <TodayFullDayCard
          claimed={dayClaims.some((c) => c.date === day)}
          onClaim={handleClaimDay}
          onCelebrate={onCelebrate}
        />
      )}
      {echoEntry && (
        <TodayEchoCapsule
          note={echoEntry.note}
          daysAgo={echoDaysAgo}
          habitName={habits.find((h) => h.id === echoEntry.habitId)?.name || '—'}
        />
      )}

      {activeReminders.length > 0 && (
        <TodayReminderBanner reminders={activeReminders} onReopen={reopenReminders} />
      )}

      <div
        style={{
          height:
            categories.length > 0 || (metCount === active.length && active.length > 0) ? 6 : 18
        }}
      />
      {active.length === 0 ? (
        <TodayEmptyState
          blueprintId={blueprint.id}
          onTemplatePick={handleTemplatePick}
          onNewHabit={handleNewHabit}
          onGoBuild={onGoBuild}
        />
      ) : (
        <TodayHabitSections
          grouped={grouped}
          checkIns={checkIns}
          now={now}
          day={day}
          enableGentleDecay={enableGentleDecay}
          onCheck={handleHabitCheck}
          onNoteSaved={handleNoteSaved}
          onEdit={handleEdit}
        />
      )}

      {archived.length > 0 && (
        <TodayArchiveSection
          archived={archived}
          showArchive={showArchive}
          archDelete={archDelete}
          onToggleArchive={() => setShowArchive((v) => !v)}
          onRestore={restoreHabit}
          onDeleteRequest={setArchDelete}
          onCancelDelete={() => setArchDelete(null)}
          onConfirmDelete={handleConfirmDeleteArchived}
        />
      )}

      <TodayOverlays
        dialogOpen={dialogOpen}
        editing={editing}
        toast={toast}
        blueprint={blueprint}
        dropModal={dropModal}
        onCloseDialog={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onEngraved={() => showToast(t.reflections.engravedToast, true)}
        onCloseDropModal={handleCloseDropModal}
      />
    </div>
  )
}
