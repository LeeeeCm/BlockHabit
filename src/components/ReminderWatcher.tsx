import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useReminderStore } from '../store/reminderStore'
import { habitMetOnDay } from '../logic/checkin'
import { todayKey } from '../logic/dates'
import { scanHabitReminder } from '../logic/reminderScheduler'
import { shouldEveningNudge } from '../logic/eveningNudge'
import { getLastNudgedDay, markNudged } from '../platform/eveningNudgePrefs'
import { playReminderChime } from '../audio/sound'
import { notify } from '../platform/notify'
import { useI18n } from '../i18n'

/** 轮询间隔：提醒粒度到分钟即可，低频省电 */
const SCAN_INTERVAL_MS = 30_000
/** 回窗补扫去重窗口 */
const WAKE_DEDUPE_MS = 2_000

/**
 * 到点提醒全局监听（仿 TimerWatcher）：
 * - 30s 轮询 + visibilitychange/focus 立即补扫（WebView 隐藏时定时器被节流的兜底）
 * - 触发 → 提示音 + 系统通知（未授权静默）+ pending 入队
 * - pending 由 ReminderDialog（合并列表）、Today 横幅、托盘 tooltip 共用
 * - 窗口藏在托盘时不做任何唤起，回窗后自然呈现（不打断为主）
 */
export function ReminderWatcher() {
  const { t } = useI18n()

  useEffect(() => {
    let disposed = false
    let lastRun = 0

    function scan() {
      if (disposed) return
      lastRun = Date.now()
      const store = useAppStore.getState()
      const reminderStore = useReminderStore.getState()
      const now = new Date()
      const day = todayKey()
      const enabled = store.settings.remindersEnabled !== false
      const log = store.reminderLog ?? {}
      const liveHabits = store.habits.filter((h) => !h.archivedAt)

      for (const habit of liveHabits) {
        if (!habit.reminder) continue
        const metToday = habitMetOnDay(habit, store.checkIns, day)
        const skippedToday = log[habit.id]?.date === day && log[habit.id]?.action === 'skipped'
        const result = scanHabitReminder({
          now,
          day,
          habit,
          remindersEnabled: enabled,
          metToday,
          skippedToday,
          track: reminderStore.tracks[habit.id]
        })
        // 仅在轨迹实际变化时写回，避免空转 tick 触发订阅重渲染
        const prev = reminderStore.tracks[habit.id]
        if (
          !prev ||
          prev.date !== result.track.date ||
          prev.startNotified !== result.track.startNotified ||
          prev.dueSoonNotified !== result.track.dueSoonNotified ||
          prev.snoozeUntilMs !== result.track.snoozeUntilMs ||
          prev.snoozeCount !== result.track.snoozeCount
        ) {
          reminderStore.setTrack(habit.id, result.track)
        }
        if (result.notify) {
          reminderStore.push({
            habitId: habit.id,
            name: habit.name,
            stage: result.notify.stage,
            start: habit.reminder.start,
            end: habit.reminder.end,
            firedAt: Date.now()
          })
          playReminderChime()
          const body =
            result.notify.stage === 'due-soon'
              ? t.reminder.dueSoonBody(habit.name)
              : t.reminder.startBody(habit.name)
          // 系统通知：Tauri 走插件（托盘/隐藏窗口态可弹），浏览器回退 Web Notification，失败静默
          void notify('BlockHabit', body)
        }
      }

      // 剪枝：提醒被移除/已归档/已达标的待展示条目自动清出（打卡后弹窗自然消失）
      for (const item of useReminderStore.getState().pending) {
        const habit = store.habits.find((h) => h.id === item.habitId)
        const stillRelevant =
          habit && !habit.archivedAt && habit.reminder && !habitMetOnDay(habit, store.checkIns, day)
        if (!stillRelevant) {
          useReminderStore.getState().dismiss(item.habitId)
        }
      }

      // 晚间收尾提醒（D-20261110-055）：每天最多一次，只在用户显式开启后；
      // 用户正看着应用时不弹系统通知（等失焦后的下一次扫描）。
      if (store.settings.eveningNudgeEnabled === true) {
        const pendingCount = liveHabits.filter((h) => !habitMetOnDay(h, store.checkIns, day)).length
        const decision = shouldEveningNudge({
          now,
          time: store.settings.eveningNudgeTime ?? '21:00',
          enabled: true,
          remindersEnabled: enabled,
          pendingCount,
          day,
          lastNudgedDay: getLastNudgedDay()
        })
        const focused =
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible' &&
          document.hasFocus()
        if (decision.fire && !focused) {
          markNudged(day)
          void notify('BlockHabit', t.eveningNudge.notificationBody(decision.pendingCount))
        }
      }
    }

    const timer = setInterval(scan, SCAN_INTERVAL_MS)
    const onWake = () => {
      if (Date.now() - lastRun > WAKE_DEDUPE_MS) scan()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    scan()
    return () => {
      disposed = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [t])

  return null
}
