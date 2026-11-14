import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useReminderStore } from '../store/reminderStore'
import { getBlueprint } from '../logic/blueprints'
import { habitMetOnDay } from '../logic/checkin'
import { trayStatusFor } from '../logic/focusSession'
import { useTodayKey } from '../logic/useTodayKey'
import { getBlueprintName, useI18n } from '../i18n'
import { inTauri } from './inTauri'
import { useFocusPhase } from './useFocusPhase'

/** 托盘状态同步：tooltip 显示今日进度，当日打卡完成后托盘图标整体变绿 */
export function TraySync() {
  const { lang, t } = useI18n()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const dayClaims = useAppStore((s) => s.dayClaims)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)
  const pendingReminders = useReminderStore((s) => s.pending.length)
  // 专注相位只随相位变化进 effect 依赖 → tooltip 只在 focusing/ready 切换时 update_tray，
  // 不做每秒倒计时 IPC（每秒 invoke 会变成高频跨进程调用）
  const focusPhase = useFocusPhase()

  const day = useTodayKey()

  useEffect(() => {
    if (!inTauri) return
    const active = habits.filter((h) => !h.archivedAt)
    // 与 Today 页同一判定口径（周频/计数习惯达标即算完成）
    const done = active.filter((h) => habitMetOnDay(h, checkIns, day)).length
    const claimed = dayClaims.some((c) => c.date === day)
    const bp = getBlueprint(activeBlueprintId)
    const placed = builds.filter((b) => b.blueprintId === activeBlueprintId).length
    const bpName = getBlueprintName(activeBlueprintId, lang)
    let status = claimed
      ? t.tray.tooltipDone
      : `${t.tray.tooltipProgress(done, active.length)} · ${bpName} ${placed}/${bp.blocks.length}`
    // 有到点提醒待处理时追加提示（回窗即可看到积木风弹窗）
    if (pendingReminders > 0) {
      status += ` · ${t.reminder.bannerTitle(pendingReminders)}`
    }
    // 专注相位后缀由纯函数拼接（ready 优先于 focusing），便于单测覆盖最终 tooltip 字符串
    status = trayStatusFor(status, focusPhase, {
      focusing: t.focusCompanion.focusing,
      ready: t.focusCompanion.ready
    })
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('update_tray', { status })
    })()
  }, [
    habits,
    checkIns,
    dayClaims,
    builds,
    activeBlueprintId,
    lang,
    t,
    day,
    pendingReminders,
    focusPhase
  ])

  return null
}
