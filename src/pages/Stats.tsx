import { useEffect, useMemo, useState } from 'react'
import { useTransient } from '../platform/useTransient'
import { useAppStore } from '../store/appStore'
import { bestStreak, currentStreak } from '../logic/streak'
import { useTodayKey } from '../logic/useTodayKey'
import { GuideTip } from '../components/GuideTip'
import { MemorabiliaDialog } from '../components/MemorabiliaDialog'
import { IconNote, IconStats } from '../components/Icons'
import { useI18n } from '../i18n'
import { triggerHaptic } from '../platform'
import { hasSeenTip, markTipSeen } from '../platform/guideTips'
import { StatsChronicleView } from './stats/StatsChronicleView'
import { StatsEchoCapsule } from './stats/StatsEchoCapsule'
import { StatsHeader } from './stats/StatsHeader'
import { StatsMetricsView } from './stats/StatsMetricsView'
import { StatsRepairDialog } from './stats/StatsRepairDialog'
import type { RepairTarget, StatsRow } from './stats/types'

export default function Stats() {
  const { t } = useI18n()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const repairBricks = useAppStore((s) => s.repairBricks ?? 0)
  const refreshRepairAllowance = useAppStore((s) => s.refreshRepairAllowance)
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

  const [repairTarget, setRepairTarget] = useState<RepairTarget | null>(null)
  // F8：进入统计页结算本月修复积木额度（跨月后打开即生效）
  useEffect(() => {
    refreshRepairAllowance()
  }, [refreshRepairAllowance])
  const [toast, showToast] = useTransient<string>(2500)
  const [memorabiliaOpen, setMemorabiliaOpen] = useState(false)
  // 页面提示（D-20261110-054）：有在册习惯时首次给出热图读法；状态初始化时只读一次 localStorage
  const [showGuideTip, setShowGuideTip] = useState(() => !hasSeenTip('stats'))

  // 稳定引用：避免 rows useMemo 每次渲染失效（切换页签重挂时自然刷新）
  const now = useMemo(() => new Date(), [])
  const today = useTodayKey()
  const active = useMemo(() => habits.filter((h) => !h.archivedAt), [habits])
  // 提示只出现在指标视图（热图所在处）；挂载即标记已读
  const guideTipVisible = showGuideTip && active.length > 0 && viewMode === 'metrics'
  useEffect(() => {
    if (guideTipVisible) markTipSeen('stats')
  }, [guideTipVisible])

  const rows = useMemo<StatsRow[]>(
    () =>
      active.map((h) => {
        const hCheckIns = checkIns.filter((c) => c.habitId === h.id)
        const totalMinutes = hCheckIns.reduce(
          (sum, c) => sum + (c.actualMinutes ?? h.targetMinutes ?? 0),
          0
        )
        return {
          habit: h,
          current: currentStreak(h, checkIns, now),
          best: bestStreak(h, checkIns),
          total: hCheckIns.length,
          totalMinutes
        }
      }),
    [active, checkIns, now]
  )

  const grandTotalMinutes = useMemo(
    () => checkIns.reduce((sum, c) => sum + (c.actualMinutes ?? 0), 0),
    [checkIns]
  )

  // 积木历史回响：提取过往（非今日）具有随笔的打卡记录
  const echoEntry = useMemo(() => {
    const candidates = checkIns.filter((c) => c.date < today && c.note?.trim())
    if (candidates.length === 0) return null
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
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
      `# BlockHabit ${t.stats.exportTitle}`,
      '',
      `> ${t.stats.exportDate}: ${new Date().toISOString().slice(0, 10)} | ${t.stats.exportCount(chronicleItems.length)}`,
      '',
      '---',
      ''
    ]
    for (const item of chronicleItems) {
      const h = habits.find((x) => x.id === item.habitId)
      const moodLabel = item.mood ? t.microMood[item.mood] : undefined
      lines.push(`### ${item.date} · ${h?.name || '—'}`)
      if (item.actualMinutes) {
        lines.push(`- **${t.stats.exportFocus}**: ${t.stats.metric.minutes(item.actualMinutes)}`)
      }
      if (moodLabel) {
        lines.push(`- **${t.stats.exportMood}**: ${moodLabel}`)
      }
      if (item.starred) {
        lines.push(`- **${t.stats.exportFeatured}**: ⭐`)
      }
      lines.push(`- **${t.stats.exportReflection}**: ${item.note}`)
      lines.push('')
    }

    const content = lines.join('\n')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content)
      } else {
        throw new Error('Clipboard API unavailable')
      }
      showToast(t.reflections.exportSuccessToast, 2500)
    } catch {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `blockhabit-chronicle-${new Date().toISOString().slice(0, 10)}.md`
      a.click()
      URL.revokeObjectURL(url)
      showToast(t.reflections.exportSuccessToast)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="page-top-bar stats-top-bar">
        <StatsHeader
          t={t}
          grandTotalMinutes={grandTotalMinutes}
          repairBricks={repairBricks}
          onOpenMemorabilia={() => setMemorabiliaOpen(true)}
        />
      </div>
      <div
        className="stats-page-container"
        style={{
          padding: '24px 24px 80px',
          maxWidth: 680,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto'
        }}
      >
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
            <span>{t.stats.tabMetrics}</span>
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
            <span>{t.stats.tabChronicle}</span>
          </button>
        </div>

        <StatsEchoCapsule t={t} echoEntry={echoEntry} echoDaysAgo={echoDaysAgo} habits={habits} />

        {/* D-20261110-054：首次进入说明热图灰阶与点击行为 */}
        {guideTipVisible && (
          <GuideTip
            variant="inline"
            title={t.guide.statsTitle}
            body={t.guide.statsBody}
            dismissLabel={t.guide.gotIt}
            onDismiss={() => setShowGuideTip(false)}
          />
        )}

        {viewMode === 'metrics' ? (
          <StatsMetricsView
            t={t}
            habits={habits}
            checkIns={checkIns}
            rows={rows}
            today={today}
            repairBricks={repairBricks}
            onRequestRepair={setRepairTarget}
            onRefreshRepair={refreshRepairAllowance}
            onToast={showToast}
          />
        ) : (
          <StatsChronicleView
            t={t}
            habits={habits}
            active={active}
            items={chronicleItems}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            filterHabitId={filterHabitId}
            onFilterHabitIdChange={setFilterHabitId}
            filterMood={filterMood}
            onFilterMoodChange={setFilterMood}
            onlyStarred={onlyStarred}
            onToggleOnlyStarred={() => setOnlyStarred((v) => !v)}
            visibleCount={visibleCount}
            onLoadMore={() => setVisibleCount((prev) => prev + 25)}
            onExportMarkdown={handleExportMarkdown}
            onToggleStar={toggleCheckInStar}
          />
        )}

        {repairTarget && (
          <StatsRepairDialog
            t={t}
            target={repairTarget}
            repairBricks={repairBricks}
            onCancel={() => setRepairTarget(null)}
            onConfirm={() => {
              const res = useRepairBrick(repairTarget.habitId, repairTarget.date)
              if (res.ok) {
                showToast(t.stats.repairSuccessToast(repairTarget.habitName), 2500)
              } else {
                const reasonToast: Record<string, string> = {
                  'no-bricks': t.stats.repairNoBricksToast,
                  already: t.stats.repairAlreadyToast,
                  'no-habit': t.stats.repairNoHabitToast,
                  archived: t.stats.repairArchivedToast,
                  future: t.stats.repairFutureToast,
                  'before-creation': t.stats.repairBeforeCreationToast
                }
                showToast(reasonToast[res.reason ?? ''] ?? t.stats.repairFailToast, 2500)
              }
            }}
          />
        )}

        {toast && <div className="toast">{toast}</div>}
        {memorabiliaOpen && <MemorabiliaDialog onClose={() => setMemorabiliaOpen(false)} />}
      </div>
    </div>
  )
}
