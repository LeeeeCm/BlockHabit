import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import type { CheckInResult, Habit, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { useReminderStore } from '../store/reminderStore'
import { useTodayKey } from '../logic/useTodayKey'
import { habitMetOnDay } from '../logic/checkin'
import { noBlockReason } from '../logic/blockHints'
import { buildTodayBrief } from '../logic/todayBrief'
import { templateFrequency, type HabitTemplate } from '../logic/habitTemplates'
import { getNudgeConsent, setNudgeConsent, type NudgeConsent } from '../platform/eveningNudgePrefs'
import { TodayBrief } from '../components/TodayBrief'
import { HabitTemplates } from '../components/HabitTemplates'
import { EveningNudgeConsent } from '../components/EveningNudgeConsent'
import { currentStreakWithResilience } from '../logic/streak'
import { blueprintOrder, getBlueprint } from '../logic/blueprints'
import { getBlueprintName, useI18n } from '../i18n'
import { HabitRow } from '../components/HabitRow'
import { HabitDialog } from '../components/HabitDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { BlockDropModal } from '../components/BlockDropModal'
import { playCelebrationSound } from '../audio/sound'
import { IconBuild, IconCheck, IconEcho, IconMoodHard, IconPlus, IconRestore, IconSparkle, IconToday, IconTrash } from '../components/Icons'
import { triggerHaptic } from '../platform'
import { ensureNotifyPermission } from '../platform/notify'

// 自上而下：任意 → 早晨 → 午后 → 夜晚
const PERIOD_ORDER: HabitPeriod[] = ['any', 'morning', 'afternoon', 'evening']

interface Props {
  onCelebrate?: () => void
  /** F1：首启引导里「看看建造页」的跳转（由 App 提供） */
  onGoBuild?: () => void
  /** 提醒「开始打卡」跳转过来时待高亮的习惯 id（消费后回调清空） */
  focusHabitId?: string | null
  onFocusConsumed?: () => void
}

export default function Today({ onCelebrate, onGoBuild, focusHabitId, onFocusConsumed }: Props) {
  const { lang, t } = useI18n()
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
  const [nudgeConsent, setNudgeConsentState] = useState<NudgeConsent | null>(() => getNudgeConsent())
  const [toast, setTransientToast] = useTransient<{ text: string; accent?: boolean }>(2400)
  const [showArchive, setShowArchive] = useState(false)
  const [archDelete, setArchDelete] = useState<Habit | null>(null)
  const [dropModal, setDropModal] = useState<{
    habitName: string
    placedCount: number
    complete: boolean
    checkInId?: string
  } | null>(null)
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
    [active, checkIns, day],
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
        completedBlueprintIds,
      }),
    [now, day, habits, checkIns, builds, activeBlueprintId, filteredActive, completedBlueprintIds],
  )
  const hasAnyCheckIn = useMemo(() => checkIns.some((c) => !c.deletedAt), [checkIns])

  const echoEntry = useMemo(() => {
    const candidates = checkIns.filter((c) => !c.deletedAt && c.date < day && c.note?.trim())
    if (candidates.length === 0) return null
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    )
    return candidates[dayOfYear % candidates.length]
  }, [checkIns, day])

  const echoDaysAgo = useMemo(() => {
    if (!echoEntry) return 0
    const todayMs = new Date(day + 'T00:00:00').getTime()
    const entryMs = new Date(echoEntry.date + 'T00:00:00').getTime()
    return Math.max(1, Math.round((todayMs - entryMs) / 86400000))
  }, [echoEntry, day])

  // 仍待处理的到点提醒（打卡/跳过/移除提醒后自动从横幅消失，与调度器剪枝同口径）
  const activeReminders = useMemo(
    () =>
      pendingReminders.filter((item) => {
        const h = habits.find((x) => x.id === item.habitId)
        return h !== undefined && !h.archivedAt && !habitMetOnDay(h, checkIns, day)
      }),
    [pendingReminders, habits, checkIns, day],
  )

  /** 滚动到某张习惯卡并脉冲高亮：提醒跳转与今日简报「开始第一个」共用同一套定位 */
  function focusHabitCard(id: string | null | undefined) {
    if (!id) return
    const el = document.getElementById(`habit-${id}`)
    if (!el) return
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    el.classList.add('habit-focus-flash')
    setTimeout(() => el.classList.remove('habit-focus-flash'), 2600)
  }

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
    [t, addHabit],
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
          checkInId: res.checkInId,
        })
        playCelebrationSound()
      } else if (res.placed) {
        setDropModal({
          habitName: h.name,
          placedCount: placedCountRef.current + 1,
          complete: false,
          checkInId: res.checkInId,
        })
      } else {
        // F2：没有掉块时必须说清原因，而不是让用户以为「积木丢了」。
        // 判别规则抽到 pure logic（logic/blockHints）以便单测；这里只负责选文案。
        const reason = noBlockReason({
          completedBlueprints: completedBlueprintIds.length,
          blueprintTotal: blueprintOrder.length,
          placedCount: placedCountRef.current,
          activeBlueprintBlocks: getBlueprint(activeBlueprintId).blocks.length,
        })
        showToast(
          reason === 'all-blueprints-complete'
            ? t.today.allBlueprintsDone
            : reason === 'active-blueprint-complete'
              ? t.today.activeCompleteNoBlock
              : t.today.checkedInToast(h.name),
          reason !== 'normal',
        )
      }
      // B1：连击每满 7 天掉落的积木是点缀色奖励块 —— 让用户知道这块为什么不一样
      if (res.bonus) showToast(t.today.streakBonusToast(7), true)
    },
    [t, completedBlueprintIds, activeBlueprintId],
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


  return (
    <div className="today-page-container" style={{ padding: '24px 24px 80px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--fs-hero)', margin: 0 }}>
          {t.common.monthDay(now.getMonth() + 1, now.getDate())}
          <span style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-subhead)', marginLeft: 10, fontWeight: 400 }}>
            {t.common.weekdayLabel(t.common.weekdays[now.getDay()])}
          </span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn ghost"
            onClick={() => {
              triggerHaptic('selection')
              onCelebrate?.()
            }}
            style={{
              padding: '4px 11px',
              fontSize: 'var(--fs-small)',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid var(--line)',
              background: 'var(--surface)',
            }}
            title={t.today.view3dModel}
          >
            <IconBuild size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{getBlueprintName(blueprint.id, lang)}</span>
            <span style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-caption)' }}>
              {placedCount}/{total} ({percent}%)
            </span>
          </button>
          <span
            style={{
              color: 'var(--ink-2)',
              fontSize: 'var(--fs-body)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: '4px 12px',
            }}
          >
            {metCount} / {active.length}
          </span>
          <button
            className="icon-btn"
            title={t.today.newHabit}
            onClick={() => {
              triggerHaptic('light')
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <IconPlus size={20} />
          </button>
        </div>
      </div>

      {brief.show && <TodayBrief brief={brief} onStartFirst={handleStartFirst} />}
      {hasAnyCheckIn && nudgeConsent === null && !nudgeEnabled && (
        <EveningNudgeConsent onEnable={handleNudgeEnable} onDecline={handleNudgeDecline} />
      )}

      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, margin: '14px 0 10px' }}>
          <button
            className={`pill-action${selectedCat === null ? ' success' : ''}`}
            style={{ fontSize: 'var(--fs-small)', padding: '3px 11px' }}
            onClick={() => {
              triggerHaptic('selection')
              setSelectedCat(null)
            }}
          >
            {t.today.filterAll} · {active.length}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`pill-action${selectedCat === cat ? ' success' : ''}`}
              style={{ fontSize: 'var(--fs-small)', padding: '3px 11px' }}
              onClick={() => {
                triggerHaptic('selection')
                setSelectedCat((curr) => (curr === cat ? null : cat))
              }}
            >
              #{cat} · {active.filter((h) => h.category === cat).length}
            </button>
          ))}
        </div>
      )}

      {metCount === active.length && active.length > 0 && (
        <div
          className="card"
          style={{
            padding: '14px 18px',
            margin: '14px 0 16px',
            borderRadius: 'var(--r-md)',
            background: 'color-mix(in srgb, var(--accent) 7%, var(--surface))',
            border: '1.5px solid color-mix(in srgb, var(--accent) 45%, var(--line))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            animation: 'pop-in var(--dur-md) var(--ease-bounce)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-subhead)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheck size={16} style={{ color: 'var(--accent)', strokeWidth: 2.2, flexShrink: 0 }} />
              <span>{t.today.fullCard.title}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', marginTop: 2 }}>
              {dayClaims.some((c) => c.date === day)
                ? t.today.fullCard.subtitlePlaced
                : t.today.fullCard.subtitlePending}
            </div>
          </div>
          {!dayClaims.some((c) => c.date === day) ? (
            <button
              className="btn primary"
              style={{
                padding: '6px 15px',
                fontSize: 'var(--fs-body)',
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                borderColor: 'var(--accent)',
                flexShrink: 0,
              }}
              onClick={() => {
                triggerHaptic('medium')
                const res = checkInDay()
                // B4：失败要给原因，成功才庆祝；连击里程碑再补一句（原先无论结果都播庆祝音 + 成功文案）
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
                showToast(res.bonus ? `${t.today.fullCard.claimToast} ${t.today.fullCard.claimBonusToast}` : t.today.fullCard.claimToast, true)
                if (res.complete) {
                  setDropModal({
                    habitName: t.today.fullCard.bonusHabitName,
                    placedCount: placedCount + 1,
                    complete: true,
                  })
                }
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span>{t.today.fullCard.claimBtn}</span>
                <IconSparkle size={13} style={{ color: 'currentColor' }} />
              </span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 'var(--fs-small)', color: 'var(--progress-green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconCheck size={14} />
                <span>{t.today.fullCard.claimed}</span>
              </span>
              {onCelebrate && (
                <button
                  className="btn ghost"
                  style={{ padding: '5px 12px', fontSize: 'var(--fs-small)', borderRadius: 999 }}
                  onClick={() => {
                    triggerHaptic('selection')
                    onCelebrate()
                  }}
                >
                  {t.todayBrief.viewBuild}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {echoEntry && (
        <div className="echo-capsule-bar" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-caption)', color: 'var(--accent)', fontWeight: 700 }}>
            <IconEcho size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>
              {t.reflections.echoTitle} · {t.reflections.echoDaysAgo(echoDaysAgo)}
            </span>
          </div>
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink)', fontStyle: 'italic', marginTop: 2, lineHeight: 1.5 }}>
            “{echoEntry.note}”
          </div>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', marginTop: 2 }}>
            {t.reflections.echoFromHabit(habits.find((h) => h.id === echoEntry.habitId)?.name || '—')}
          </div>
        </div>
      )}

      {activeReminders.length > 0 && (
        <div
          className="reminder-banner"
          role="button"
          tabIndex={0}
          onClick={() => {
            triggerHaptic('light')
            reopenReminders()
          }}
          onKeyDown={(e) => e.key === 'Enter' && reopenReminders()}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-subhead)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--ink-2)' }}>
                <IconMoodHard size={14} />
              </span>
              <span>{t.reminder.bannerTitle(activeReminders.length)}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeReminders.map((r) => r.name).join(' · ')} — {t.reminder.bannerHint}
            </div>
          </div>
          <span style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-heading)', flexShrink: 0 }} aria-hidden="true">›</span>
        </div>
      )}

      <div style={{ height: categories.length > 0 || (metCount === active.length && active.length > 0) ? 6 : 18 }} />
      {active.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '22px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderRadius: 'var(--r-lg)',
            background: 'color-mix(in srgb, var(--surface) 96%, var(--ink))',
            border: '1px dashed var(--line)',
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              marginBottom: 2,
            }}
          >
            <IconToday size={24} />
          </div>
          <div style={{ fontSize: 'var(--fs-title)', fontWeight: 700, color: 'var(--ink)' }}>
            {t.today.startJourney}
          </div>
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-2)', maxWidth: 380, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {t.today.emptyHint(getBlueprintName(blueprint.id, lang))}
          </div>
          {/* F1 首启三步引导：把「打卡 → 掉积木 → 拼成作品」这条主线讲清楚 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              width: '100%',
              maxWidth: 420,
              marginTop: 6,
              textAlign: 'left',
            }}
          >
            {[
              { n: '01', title: t.today.onboardingStep1Title, body: t.today.onboardingStep1Body },
              { n: '02', title: t.today.onboardingStep2Title, body: t.today.onboardingStep2Body },
              { n: '03', title: t.today.onboardingStep3Title, body: t.today.onboardingStep3Body },
            ].map((step) => (
              <div key={step.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    fontFamily: "'Rubik', sans-serif",
                    fontWeight: 700,
                    fontSize: 'var(--fs-caption)',
                    letterSpacing: 0.5,
                    color: 'var(--ink-2)',
                    marginTop: 3,
                    minWidth: 18,
                  }}
                >
                  {step.n}
                </span>
                <div>
                  <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink)' }}>{step.title}</div>
                  <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', lineHeight: 1.6 }}>{step.body}</div>
                </div>
              </div>
            ))}
          </div>
          <HabitTemplates onPick={handleTemplatePick} />
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="btn primary"
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--fs-body)',
              }}
              onClick={() => {
                triggerHaptic('light')
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <IconPlus size={16} />
              <span>{t.today.newHabit}</span>
            </button>
            {onGoBuild && (
              <button
                className="btn ghost"
                style={{ padding: '8px 18px', borderRadius: 999, fontSize: 'var(--fs-body)' }}
                onClick={() => {
                  triggerHaptic('selection')
                  onGoBuild()
                }}
              >
                {t.today.onboardingSeeBuild}
              </button>
            )}
          </div>
        </div>
      ) : (
        PERIOD_ORDER.map((p) => {
          const list = grouped.get(p)!
          if (list.length === 0) return null
          return (
            <section key={p} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 'var(--fs-small)',
                  color: 'var(--ink-2)',
                  letterSpacing: '0.14em',
                  margin: '4px 2px 10px',
                }}
              >
                {t.today.periods[p]}
              </div>
              <div className="habit-grid">
                {list.map((h) => {
                  const streakInfo = currentStreakWithResilience(h, checkIns, now, enableGentleDecay)
                  // 完成态 = 今日有打卡 且 达标（counter 未满目标不亮绿勾；周频达标但今日未打卡不算完成）
                  const doneToday =
                    checkIns.some((c) => !c.deletedAt && c.habitId === h.id && c.date === day) &&
                    habitMetOnDay(h, checkIns, day)
                  return (
                    <HabitRow
                      key={h.id}
                      habit={h}
                      day={day}
                      done={doneToday}
                      streak={streakInfo.streak}
                      inRestPeriod={streakInfo.inRestPeriod}
                      resilienceProtected={streakInfo.protectedContinuation === true}
                      onCheck={handleHabitCheck}
                      onNoteSaved={handleNoteSaved}
                      onEdit={handleEdit}
                      domId={`habit-${h.id}`}
                    />
                  )
                })}
              </div>
            </section>
          )
        })
      )}

      {archived.length > 0 && (
        <section style={{ maxWidth: 720, margin: '28px auto 0', padding: '0 24px' }}>
          <button
            className="archive-toggle"
            onClick={() => setShowArchive((v) => !v)}
            title={showArchive ? t.today.collapse : t.today.expand}
          >
            <span>{t.today.archivedCount(archived.length)}</span>
            <span style={{ fontSize: 'var(--fs-caption)' }}>{showArchive ? t.today.collapse : t.today.expand}</span>
          </button>
          {showArchive && (
            <div className="archive-list">
              {archived.map((h) => (
                <div key={h.id} className="archive-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-subhead)', color: 'var(--ink-2)' }}>{h.name}</div>
                    <div style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-2)', opacity: 0.7 }}>
                      {h.frequency.type === 'daily'
                        ? t.today.freqDaily
                        : h.frequency.type === 'weekly'
                          ? t.today.freqWeekly(h.frequency.times)
                          : t.today.freqCustom(h.frequency.days.map((d) => t.common.weekdaysShort[d - 1]))}
                      {h.targetMinutes ? ` · ${t.common.timeMinutes(h.targetMinutes)}` : ''}
                      {h.targetValue ? ` · ${h.targetValue} ${h.unit ?? ''}` : ''}
                    </div>
                  </div>
                  <button className="archive-act" title={t.common.restore} onClick={() => restoreHabit(h.id)}>
                    <IconRestore size={16} />
                    {t.common.restore}
                  </button>
                  <button
                    className="archive-act"
                    title={t.common.delete}
                    onClick={() => setArchDelete(h)}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {archDelete && (
            <div style={{ marginTop: 8 }}>
              <ConfirmDialog
                title={t.today.deleteConfirmTitle}
                message={t.today.deleteConfirmMsg(archDelete.name)}
                confirmLabel={t.common.delete}
                cancelLabel={t.common.cancel}
                danger
                onCancel={() => setArchDelete(null)}
                onConfirm={() => {
                  deleteHabit(archDelete.id)
                  setArchDelete(null)
                }}
              />
            </div>
          )}
        </section>
      )}

      {dialogOpen && (
        <HabitDialog
          habit={editing ?? undefined}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
        />
      )}
      {toast && (
        <div className="toast">
          {toast.accent ? <span className="accent">◆ </span> : null}
          {toast.text}
        </div>
      )}
      {dropModal && (
        <BlockDropModal
          blueprint={blueprint}
          placedCount={dropModal.placedCount}
          habitName={dropModal.habitName}
          complete={dropModal.complete}
          checkInId={dropModal.checkInId}
          onEngraved={() => showToast(t.reflections.engravedToast, true)}
          onClose={() => {
            const wasComplete = dropModal.complete
            setDropModal(null)
            if (wasComplete) {
              onCelebrate?.()
            }
          }}
        />
      )}
    </div>
  )
}
