import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CheckInResult, Habit, HabitPeriod } from '../types'
import { useAppStore } from '../store/appStore'
import { useTodayKey } from '../logic/useTodayKey'
import { habitMetOnDay } from '../logic/checkin'
import { currentStreakWithResilience } from '../logic/streak'
import { getBlueprint } from '../logic/blueprints'
import { getBlueprintName, useI18n } from '../i18n'
import { HabitRow } from '../components/HabitRow'
import { HabitDialog } from '../components/HabitDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { BlockDropModal } from '../components/BlockDropModal'
import { playCelebrationSound } from '../audio/sound'
import { IconBuild, IconCheck, IconEcho, IconPlus, IconRestore, IconSparkle, IconToday, IconTrash } from '../components/Icons'
import { triggerHaptic } from '../platform'

// 自上而下：任意 → 早晨 → 午后 → 夜晚
const PERIOD_ORDER: HabitPeriod[] = ['any', 'morning', 'afternoon', 'evening']

interface Props {
  onCelebrate?: () => void
}

export default function Today({ onCelebrate }: Props) {
  const { lang, t } = useI18n()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const dayClaims = useAppStore((s) => s.dayClaims)
  const checkInDay = useAppStore((s) => s.checkInDay)
  const restoreHabit = useAppStore((s) => s.restoreHabit)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const enableGentleDecay = useAppStore((s) => s.settings.enableGentleDecay !== false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [toast, setToast] = useState<{ text: string; accent?: boolean } | null>(null)
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
  function showToast(text: string, accent = false) {
    setToast({ text, accent })
    setTimeout(() => setToast(null), 2400)
  }

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
        showToast(t.today.checkedInToast(h.name))
      }
    },
    [t],
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
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {lang === 'zh' ? (
            <>
              {now.getMonth() + 1} 月 {now.getDate()} 日
              <span style={{ color: 'var(--ink-2)', fontSize: 14, marginLeft: 10, fontWeight: 400 }}>
                周{t.common.weekdays[now.getDay()]}
              </span>
            </>
          ) : (
            <span>
              {t.common.dateHeader(now.getFullYear(), now.getMonth() + 1, now.getDate(), t.common.weekdays[now.getDay()])}
            </span>
          )}
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
              fontSize: 12,
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
            <span style={{ color: 'var(--ink-2)', fontSize: 11 }}>
              {placedCount}/{total} ({percent}%)
            </span>
          </button>
          <span
            style={{
              color: 'var(--ink-2)',
              fontSize: 13,
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

      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, margin: '14px 0 10px' }}>
          <button
            className={`pill-action${selectedCat === null ? ' success' : ''}`}
            style={{ fontSize: 11.5, padding: '3px 11px' }}
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
              style={{ fontSize: 11.5, padding: '3px 11px' }}
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
            animation: 'pop-in 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconCheck size={16} style={{ color: 'var(--accent)', strokeWidth: 2.2, flexShrink: 0 }} />
              <span>{t.today.fullCard.title}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
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
                fontSize: 12.5,
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                borderColor: 'var(--accent)',
                flexShrink: 0,
              }}
              onClick={() => {
                triggerHaptic('medium')
                const res = checkInDay()
                playCelebrationSound()
                showToast(t.today.fullCard.claimToast, true)
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
            <span style={{ fontSize: 12, color: 'var(--progress-green)', fontWeight: 600, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IconCheck size={14} />
              <span>{t.today.fullCard.claimed}</span>
            </span>
          )}
        </div>
      )}
      {echoEntry && (
        <div className="echo-capsule-bar" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
            <IconEcho size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>
              {t.reflections.echoTitle} · {t.reflections.echoDaysAgo(echoDaysAgo)}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', fontStyle: 'italic', marginTop: 2, lineHeight: 1.5 }}>
            “{echoEntry.note}”
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>
            {t.reflections.echoFromHabit(habits.find((h) => h.id === echoEntry.habitId)?.name || '—')}
          </div>
        </div>
      )}

      <div style={{ height: categories.length > 0 || (metCount === active.length && active.length > 0) ? 6 : 18 }} />
      {active.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '52px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            borderRadius: 'var(--r-lg)',
            background: 'color-mix(in srgb, var(--surface) 96%, var(--ink))',
            border: '1px dashed var(--line)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              marginBottom: 4,
            }}
          >
            <IconToday size={28} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
            {t.today.startJourney}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 360, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {t.today.emptyHint(getBlueprintName(blueprint.id, lang))}
          </div>
          <button
            className="btn primary"
            style={{
              marginTop: 6,
              padding: '8px 20px',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
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
        </div>
      ) : (
        PERIOD_ORDER.map((p) => {
          const list = grouped.get(p)!
          if (list.length === 0) return null
          return (
            <section key={p} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 12,
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
                  return (
                    <HabitRow
                      key={h.id}
                      habit={h}
                      day={day}
                      done={checkIns.some((c) => !c.deletedAt && c.habitId === h.id && c.date === day)}
                      streak={streakInfo.streak}
                      inRestPeriod={streakInfo.inRestPeriod}
                      onCheck={handleHabitCheck}
                      onNoteSaved={handleNoteSaved}
                      onEdit={handleEdit}
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
            <span style={{ fontSize: 11 }}>{showArchive ? t.today.collapse : t.today.expand}</span>
          </button>
          {showArchive && (
            <div className="archive-list">
              {archived.map((h) => (
                <div key={h.id} className="archive-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{h.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)', opacity: 0.7 }}>
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
