import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { bestStreak, currentStreak } from '../logic/streak'
import { useTodayKey } from '../logic/useTodayKey'
import { Heatmap } from '../components/Heatmap'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MonthlyPosterModal } from '../components/MonthlyPosterModal'
import { IconEcho, IconExport, IconMood, IconNote, IconPoster, IconRepair, IconStar, IconStats } from '../components/Icons'
import { useI18n } from '../i18n'
import { triggerHaptic } from '../platform'
import type { MicroMood } from '../types'

const MOODS: MicroMood[] = ['energetic', 'hard', 'spark', 'calm']

export default function Stats() {
  const { lang, t } = useI18n()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const repairBricks = useAppStore((s) => s.repairBricks ?? 0)
  const useRepairBrick = useAppStore((s) => s.useRepairBrick)
  const toggleCheckInStar = useAppStore((s) => s.toggleCheckInStar)

  const [viewMode, setViewMode] = useState<'metrics' | 'chronicle'>('metrics')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterHabitId, setFilterHabitId] = useState<string>('all')
  const [filterMood, setFilterMood] = useState<string>('all')
  const [onlyStarred, setOnlyStarred] = useState(false)
  const [visibleCount, setVisibleCount] = useState(25)

  useEffect(() => {
    setVisibleCount(25)
  }, [filterHabitId, filterMood, onlyStarred, searchQuery])

  const [repairTarget, setRepairTarget] = useState<{ habitId: string; habitName: string; date: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [posterOpen, setPosterOpen] = useState(false)

  // 稳定引用：避免 rows useMemo 每次渲染失效（切换页签重挂时自然刷新）
  const now = useMemo(() => new Date(), [])
  const today = useTodayKey()
  const active = useMemo(() => habits.filter((h) => !h.archivedAt), [habits])

  const rows = useMemo(
    () =>
      active.map((h) => {
        const hCheckIns = checkIns.filter((c) => c.habitId === h.id)
        const totalMinutes = hCheckIns.reduce(
          (sum, c) => sum + (c.actualMinutes ?? h.targetMinutes ?? 0),
          0,
        )
        return {
          habit: h,
          current: currentStreak(h, checkIns, now),
          best: bestStreak(h, checkIns),
          total: hCheckIns.length,
          totalMinutes,
        }
      }),
    [active, checkIns, now],
  )

  const grandTotalMinutes = useMemo(
    () => checkIns.reduce((sum, c) => sum + (c.actualMinutes ?? 0), 0),
    [checkIns],
  )

  // 积木历史回响：提取过往（非今日）具有随笔的打卡记录
  const echoEntry = useMemo(() => {
    const candidates = checkIns.filter((c) => c.date < today && c.note?.trim())
    if (candidates.length === 0) return null
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    )
    return candidates[dayOfYear % candidates.length]
  }, [checkIns, today])

  const echoDaysAgo = useMemo(() => {
    if (!echoEntry) return 0
    const todayMs = new Date(today + 'T00:00:00').getTime()
    const entryMs = new Date(echoEntry.date + 'T00:00:00').getTime()
    return Math.max(1, Math.round((todayMs - entryMs) / 86400000))
  }, [echoEntry, today])
  // 手账长廊项目过滤
  const chronicleItems = useMemo(() => {
    let list = checkIns.filter((c) => c.note?.trim())
    if (filterHabitId !== 'all') {
      list = list.filter((c) => c.habitId === filterHabitId)
    }
    if (filterMood !== 'all') {
      list = list.filter((c) => c.mood === filterMood)
    }
    if (onlyStarred) {
      list = list.filter((c) => c.starred)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((c) => {
        const h = habits.find((x) => x.id === c.habitId)
        const moodText = c.mood ? t.microMood[c.mood].toLowerCase() : ''
        return (
          c.note?.toLowerCase().includes(q) ||
          c.date.includes(q) ||
          h?.name.toLowerCase().includes(q) ||
          moodText.includes(q)
        )
      })
    }
    list.sort((a, b) => b.date.localeCompare(a.date))
    return list
  }, [checkIns, filterHabitId, filterMood, onlyStarred, searchQuery, habits, t.microMood])

  async function handleExportMarkdown() {
    const lines = [
      `# BlockHabit ${lang === 'zh' ? '自律手账与建造纪元' : 'Chronicle of Discipline'}`,
      '',
      `> ${lang === 'zh' ? '导出日期' : 'Exported'}: ${new Date().toISOString().slice(0, 10)} | ${lang === 'zh' ? `共 ${chronicleItems.length} 条随笔记录` : `${chronicleItems.length} reflections recorded`}`,
      '',
      '---',
      '',
    ]
    for (const item of chronicleItems) {
      const h = habits.find((x) => x.id === item.habitId)
      const moodLabel = item.mood ? t.microMood[item.mood] : undefined
      lines.push(`### ${item.date} · ${h?.name || '—'}`)
      if (item.actualMinutes) {
        lines.push(`- **${lang === 'zh' ? '专注' : 'Focus'}**: ${item.actualMinutes} ${lang === 'zh' ? '分钟' : 'min'}`)
      }
      if (moodLabel) {
        lines.push(`- **${lang === 'zh' ? '心境' : 'Mood'}**: ${moodLabel}`)
      }
      if (item.starred) {
        lines.push(`- **${lang === 'zh' ? '精选' : 'Featured'}**: ⭐`)
      }
      lines.push(`- **${lang === 'zh' ? '感悟' : 'Reflection'}**: ${item.note}`)
      lines.push('')
    }

    const content = lines.join('\n')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content)
      } else {
        throw new Error('Clipboard API unavailable')
      }
      setToast(t.reflections.exportSuccessToast)
    } catch {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `blockhabit-chronicle-${new Date().toISOString().slice(0, 10)}.md`
      a.click()
      URL.revokeObjectURL(url)
      setToast(t.reflections.exportSuccessToast)
    }
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div className="stats-page-container" style={{ padding: '28px 24px 80px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>{t.stats.title}</h1>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 18 }}>
            {t.stats.subtitle}
            {grandTotalMinutes > 0 && (
              <span> · {t.stats.focusHours((grandTotalMinutes / 60).toFixed(1))}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn ghost"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 12px',
              fontSize: 12,
              borderRadius: 999,
              flexShrink: 0,
            }}
            onClick={() => {
              triggerHaptic('light')
              setPosterOpen(true)
            }}
            title={lang === 'zh' ? '生成月度包豪斯自律画报' : 'Generate Monthly Discipline Poster'}
          >
            <IconPoster size={14} style={{ color: 'var(--ink)' }} />
            <span>{lang === 'zh' ? '月度画报' : 'Poster'}</span>
          </button>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
            title={t.stats.repairBricksTooltip}
          >
            <IconRepair size={13} style={{ color: 'var(--accent)' }} />
            <span>{t.stats.repairBricksBadge(repairBricks)}</span>
          </div>
        </div>
      </div>

      {/* 苹果风格分段视图控制器 */}
      <div className="apple-segmented" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className={`apple-segmented-item${viewMode === 'metrics' ? ' active' : ''}`}
          onClick={() => {
            triggerHaptic('selection')
            setViewMode('metrics')
          }}
        >
          <IconStats size={14} />
          <span>{lang === 'zh' ? '指标热图' : 'Metrics'}</span>
        </button>
        <button
          type="button"
          className={`apple-segmented-item${viewMode === 'chronicle' ? ' active' : ''}`}
          onClick={() => {
            triggerHaptic('selection')
            setViewMode('chronicle')
          }}
        >
          <IconNote size={14} />
          <span>{lang === 'zh' ? '自律手账' : 'Chronicle'}</span>
        </button>
      </div>

      {/* 积木历史回响时间胶囊 */}
      {echoEntry && (
        <div className="echo-capsule-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
            <IconEcho size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>
              {t.reflections.echoTitle} · {t.reflections.echoDaysAgo(echoDaysAgo)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', marginTop: 2, lineHeight: 1.5 }}>
            “{echoEntry.note}”
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>
            — 来自【{habits.find((h) => h.id === echoEntry.habitId)?.name || '—'}】
          </div>
        </div>
      )}

      {/* 视图分支 */}
      {viewMode === 'metrics' ? (
        <div>
          {rows.length === 0 ? (
            <div style={{ color: 'var(--ink-2)', fontSize: 14 }}>{t.stats.empty}</div>
          ) : (
            rows.map(({ habit, current, best, total, totalMinutes }) => (
              <div
                key={habit.id}
                className="card"
                style={{
                  padding: '16px 18px',
                  marginBottom: 14,
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <Heatmap
                    habits={habits}
                    checkIns={checkIns}
                    habitId={habit.id}
                    cell={13}
                    weeks={13}
                    onDayClick={(day) => {
                      const todayMs = new Date(today + 'T00:00:00').getTime()
                      const diffDays = Math.round((todayMs - new Date(day + 'T00:00:00').getTime()) / 86400000)
                      const already = checkIns.some((c) => c.habitId === habit.id && c.date === day)
                      if (already) return
                      if (diffDays > 7 || diffDays < 0) {
                        setToast(t.stats.repairLimitToast)
                        setTimeout(() => setToast(null), 2200)
                        return
                      }
                      if (repairBricks <= 0) {
                        setToast(t.stats.repairNoBricksToast)
                        setTimeout(() => setToast(null), 2600)
                        return
                      }
                      setRepairTarget({ habitId: habit.id, habitName: habit.name, date: day })
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15 }}>{habit.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                      {habit.frequency.type === 'daily'
                        ? t.today.freqDaily
                        : habit.frequency.type === 'weekly'
                          ? t.today.freqWeekly(habit.frequency.times)
                          : t.today.freqCustom(habit.frequency.days.map((d) => t.common.weekdaysShort[d - 1]))}
                    </div>
                  </div>
                  {totalMinutes > 0 && (
                    <Stat
                      label={lang === 'zh' ? '专注时长' : 'Focus'}
                      value={
                        totalMinutes >= 60
                          ? (lang === 'zh' ? `${(totalMinutes / 60).toFixed(1)} 小时` : `${(totalMinutes / 60).toFixed(1)}h`)
                          : (lang === 'zh' ? `${totalMinutes} 分钟` : `${totalMinutes}m`)
                      }
                    />
                  )}
                  <Stat label={lang === 'zh' ? '当前连击' : 'Current'} value={current} accent={current > 0 && current % 7 === 0} />
                  <Stat label={lang === 'zh' ? '最长连击' : 'Best'} value={best} />
                  <Stat label={lang === 'zh' ? '总打卡' : 'Total'} value={total} />
                </div>

                {(() => {
                  const notes = checkIns
                    .filter((c) => c.habitId === habit.id && c.note?.trim())
                    .sort((a, b) => (b.date > a.date ? 1 : -1))
                    .slice(0, 3)
                  if (notes.length === 0) return null
                  return (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
                      <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <IconNote size={13} style={{ color: 'var(--ink-2)', flexShrink: 0 }} />
                        <span>{lang === 'zh' ? '近期打卡随笔' : 'Recent Reflections'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {notes.map((n) => (
                          <div key={n.id} style={{ fontSize: 12, color: 'var(--ink)', display: 'flex', gap: 8, alignItems: 'baseline' }}>
                            <span style={{ fontSize: 11, color: 'var(--ink-2)', flexShrink: 0 }}>{n.date}</span>
                            <span style={{ minWidth: 0, wordBreak: 'break-word', opacity: 0.88 }}>{n.note}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ))
          )}
        </div>
      ) : (
        /* 手账长廊视图 */
        <div>
          {/* 筛选与检索栏 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)',
              padding: '12px 14px',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.reflections.searchPlaceholder}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)',
                  background: 'color-mix(in srgb, var(--ink) 2%, transparent)',
                  fontSize: 12.5,
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              <button
                className="btn ghost"
                onClick={handleExportMarkdown}
                style={{ fontSize: 12, padding: '7px 12px', borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                title={t.reflections.exportMarkdown}
              >
                <IconExport size={13} style={{ flexShrink: 0 }} />
                <span>{lang === 'zh' ? '导出 MD' : 'Export MD'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={filterHabitId}
                onChange={(e) => setFilterHabitId(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: 11.5,
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              >
                <option value="all">{t.reflections.filterAll}</option>
                {active.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>

              <div className="micro-mood-group">
                <button
                  type="button"
                  className={`micro-mood-chip${filterMood === 'all' ? ' active' : ''}`}
                  onClick={() => setFilterMood('all')}
                >
                  {lang === 'zh' ? '全部心境' : 'All Moods'}
                </button>
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`micro-mood-chip${filterMood === m ? ' active' : ''}`}
                    onClick={() => setFilterMood((prev) => (prev === m ? 'all' : m))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <IconMood mood={m} size={13} style={{ flexShrink: 0 }} />
                    <span>{t.microMood[m]}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={`pill-action${onlyStarred ? ' active' : ''}`}
                style={{
                  fontSize: 11.5,
                  padding: '3px 10px',
                  color: onlyStarred ? 'var(--accent)' : 'var(--ink-2)',
                  background: onlyStarred ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : undefined,
                }}
                onClick={() => {
                  triggerHaptic('selection')
                  setOnlyStarred((v) => !v)
                }}
              >
                <IconStar size={12} filled={onlyStarred} style={{ color: onlyStarred ? 'var(--accent)' : 'currentColor' }} />
                <span>{t.reflections.onlyStarred}</span>
              </button>
            </div>
          </div>

          {/* 列表流 */}
          {chronicleItems.length === 0 ? (
            <div style={{ color: 'var(--ink-2)', fontSize: 13, textAlign: 'center', padding: '36px 0' }}>
              {t.reflections.emptyChronicle}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chronicleItems.slice(0, visibleCount).map((item) => {
                const h = habits.find((x) => x.id === item.habitId)
                return (
                  <div key={item.id} className="chronicle-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                          {item.date}
                        </span>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                          【{h?.name || '—'}】
                        </span>
                        {item.actualMinutes && (
                          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                            · {item.actualMinutes} {lang === 'zh' ? '分钟' : 'min'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.mood && (
                          <span
                            style={{
                              fontSize: 10.5,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
                              color: 'var(--ink)',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <IconMood mood={item.mood} size={11} style={{ flexShrink: 0 }} />
                            <span>{t.microMood[item.mood]}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          className={`star-toggle-btn${item.starred ? ' starred' : ''}`}
                          style={{ padding: '3px 7px' }}
                          onClick={() => {
                            triggerHaptic('selection')
                            toggleCheckInStar(item.id)
                          }}
                        >
                          <IconStar size={13} filled={item.starred} />
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55 }}>
                      “{item.note}”
                    </div>
                  </div>
                )
              })}
            </div>
              {chronicleItems.length > visibleCount && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button
                    type="button"
                    className="pill-action"
                    style={{ padding: '7px 20px', fontSize: 12 }}
                    onClick={() => {
                      triggerHaptic('light')
                      setVisibleCount((prev) => prev + 25)
                    }}
                  >
                    {lang === 'zh'
                      ? `加载更多随笔 (${visibleCount}/${chronicleItems.length})`
                      : `Load More (${visibleCount}/${chronicleItems.length})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {repairTarget && (
        <ConfirmDialog
          title={t.stats.repairDialogTitle}
          message={t.stats.repairDialogMsg(repairTarget.habitName, repairTarget.date, repairBricks)}
          confirmLabel={t.common.confirm}
          cancelLabel={t.common.cancel}
          danger={false}
          onCancel={() => setRepairTarget(null)}
          onConfirm={() => {
            const res = useRepairBrick(repairTarget.habitId, repairTarget.date)
            if (res.ok) {
              setToast(t.stats.repairSuccessToast(repairTarget.habitName))
            } else {
              const reasonToast: Record<string, string> = {
                'no-bricks': t.stats.repairNoBricksToast,
                already: t.stats.repairAlreadyToast,
                'no-habit': t.stats.repairNoHabitToast,
                archived: t.stats.repairArchivedToast,
                future: t.stats.repairFutureToast,
              }
              setToast(reasonToast[res.reason ?? ''] ?? t.stats.repairFailToast)
            }
            setTimeout(() => setToast(null), 2500)
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
      {posterOpen && <MonthlyPosterModal onClose={() => setPosterOpen(false)} />}
    </div>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: accent ? 'var(--progress-green)' : 'var(--ink)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{label}</div>
    </div>
  )
}
