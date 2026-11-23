import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import type { CheckInResult, Habit, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { useReminderStore } from '../store/reminderStore'
import { useTimerStore } from '../store/timerStore'
import { useTodayKey } from '../logic/useTodayKey'
import { canCheckInHabit, habitMetOnDay, weekCountFor } from '../logic/checkin'
import { parseKey } from '../logic/dates'
import { noBlockReason } from '../logic/blockHints'
import { templateFrequency, type HabitTemplate } from '../logic/habitTemplates'
import { blueprintOrder, getBlueprint } from '../logic/blueprints'
import { useI18n } from '../i18n'
import { playCelebrationSound } from '../audio/sound'
import { triggerHaptic, usePlatform } from '../platform'
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
  /** 提醒「开始打卡」跳转过来时待高亮的习惯 id（消费后回调清空） */
  focusHabitId?: string | null
  onFocusConsumed?: () => void
}

export default function Today({ onCelebrate, focusHabitId, onFocusConsumed }: Props) {
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
  const pendingReminders = useReminderStore((s) => s.pending)
  const reopenReminders = useReminderStore((s) => s.reopen)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [toast, setTransientToast] = useTransient<TodayToast>(2400)
  const [showArchive, setShowArchive] = useState(false)
  const [archDelete, setArchDelete] = useState<Habit | null>(null)
  const [dropModal, setDropModal] = useState<DropModalState | null>(null)
  // 「今天」由统一 hook 驱动：10s 轮询 + 聚焦/可见性刷新（跨午夜翻转）
  const day = useTodayKey()
  /** 连击计算只需要"今天"这个日期；每次渲染从 day 派生，避免缓存跨时区失效 */
  const todayDate = parseKey(day)
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
        return (
          h !== undefined &&
          !h.archivedAt &&
          !habitMetOnDay(h, checkIns, day) &&
          canCheckInHabit(h, checkIns, day).ok
        )
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

  const handleTemplatePick = useCallback(
    (template: HabitTemplate) => {
      triggerHaptic('light')
      const name = t.templates[template.id]
      addHabit(name, templateFrequency(), { period: template.period })
      showToast(t.templates.created(name), true)
    },
    [t, addHabit]
  )

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

  /** 被拒打卡的可读回执：周频配额满 / 今天已经打过。
   * 回调保持稳定（不依赖 checkIns），否则任意一次打卡都会让所有习惯卡重渲染。 */
  const handleHabitBlocked = useCallback(
    (reason: 'already' | 'weekly-full', h: Habit) => {
      if (reason === 'weekly-full' && h.frequency.type === 'weekly') {
        const latest = useAppStore.getState().checkIns
        showToast(t.today.weekQuotaDone(weekCountFor(latest, h.id, day), h.frequency.times))
      } else {
        showToast(t.today.alreadyCheckedIn)
      }
    },
    [t, day]
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
        now={todayDate}
        blueprintId={blueprint.id}
        placedCount={placedCount}
        total={total}
        percent={percent}
        metCount={metCount}
        activeCount={active.length}
        onCelebrate={onCelebrate}
        onNewHabit={handleNewHabit}
      />

      {focusStartHabit && (
        <TodayFocusEntry
          habit={focusStartHabit}
          isMobile={isMobile}
          onStart={() => handleStartFocus(focusStartHabit)}
        />
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
        <TodayEmptyState onTemplatePick={handleTemplatePick} onNewHabit={handleNewHabit} />
      ) : (
        <TodayHabitSections
          grouped={grouped}
          checkIns={checkIns}
          now={todayDate}
          day={day}
          enableGentleDecay={enableGentleDecay}
          onCheck={handleHabitCheck}
          onBlocked={handleHabitBlocked}
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
