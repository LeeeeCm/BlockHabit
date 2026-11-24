import { useEffect, useRef } from 'react'
import { useTransient } from '../platform/useTransient'
import { IconCheck } from '../components/Icons'
import { useAppStore } from '../store/appStore'
import { useTimerStore } from '../store/timerStore'
import { planFocusNotifications } from '../logic/focusSession'
import { notify } from '../platform/notify'
import { useI18n } from '../i18n'

/**
 * 专注到点提醒（B2 / D-20261110-064）：
 * - 绝对时间判定（应用隐藏/最小化/退出都不暂停）；
 * - 到点只提醒一次，并且 **先把 notifiedAt 落盘再弹**：重启后不重复通知；
 * - 顺带 prune：已删除/已归档习惯的会话、超过 TTL 的过期会话都清掉；
 * - 不自动打卡（数据诚实），确认落块在摆件/今日页由用户完成。
 */
export function TimerWatcher({ preferPet = false }: { preferPet?: boolean }) {
  const { t } = useI18n()
  const petRef = useRef(preferPet)
  petRef.current = preferPet
  const habits = useAppStore((s) => s.habits)
  const [toast, showToast] = useTransient<string>(5200)
  // 长生命周期 interval 里读最新引用：语言/习惯变化不需要重建定时器
  const toastRef = useRef(showToast)
  toastRef.current = showToast
  const tRef = useRef(t)
  tRef.current = t
  const habitsRef = useRef(habits)
  habitsRef.current = habits

  useEffect(() => {
    const scan = () => {
      const now = Date.now()
      const currentHabits = habitsRef.current
      const activeIds = new Set(currentHabits.filter((h) => !h.archivedAt).map((h) => h.id))
      useTimerStore.getState().prune(activeIds, now)
      // 通知计划是纯函数（logic/focusSession）：只有 ready 且未提醒的会话才进计划，
      // 这里只负责「先落盘 → 再弹」的副作用顺序。
      const plans = planFocusNotifications(useTimerStore.getState().sessions, now, activeIds)
      for (const plan of plans) {
        const habit = currentHabits.find((h) => h.id === plan.habitId)
        if (!habit) continue
        // 先落盘再去弹：即使进程立刻被杀，重开也不会重复通知
        useTimerStore.getState().markNotified(plan.habitId, plan.notifiedAt)
        if (!petRef.current || document.visibilityState !== 'visible') {
          const msg = tRef.current.focusCompanion.notificationBody(habit.name)
          toastRef.current(msg, 5200)
          void notify('BlockHabit', msg)
        }
      }
    }
    scan()
    const timer = window.setInterval(scan, 1000)
    document.addEventListener('visibilitychange', scan)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', scan)
    }
  }, [])

  if (!toast || preferPet) return null
  return (
    <div
      className="toast"
      style={{
        bottom: 150,
        maxWidth: '80vw',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}
    >
      <span
        className="accent"
        style={{
          color: 'var(--progress-green)',
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
          marginRight: 5
        }}
      >
        <IconCheck size={14} />
      </span>
      {toast}
    </div>
  )
}
