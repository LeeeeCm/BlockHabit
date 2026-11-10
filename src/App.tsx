import { clearCubeSpriteCache } from './render/isoCube'
import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react'
import { useTransient } from './platform/useTransient'
import { currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize, primaryMonitor } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { initPersistence, useAppStore, forceFlush, persistenceReady, isDemoMode } from './store/appStore'
import { cacheAppearance } from './platform/appearance'
import { pickAdapter } from './storage'
import { setSoundMuted, setVolume } from './audio/sound'
import { getBlueprint } from './logic/blueprints'
import { useTimerStore } from './store/timerStore'
import { primarySessionId, viewSession, type FocusPhase } from './logic/focusSession'
import { useReminderStore } from './store/reminderStore'
import { getBlueprintName, useI18n } from './i18n'
import Today from './pages/Today'
import Build from './pages/Build'
import Showcase from './pages/Showcase'
import Stats from './pages/Stats'

// D-20261110-056 追加修正：页面用 React.lazy 会带来首次切页 ~300ms 的 Suspense 延迟提交
// （见 .tmp-perf/report.md §5）；改为静态 import，换取切页即时。只有迷你摆件仍懒加载
// （它只在迷你模式出现，且静态依赖 BuildScene）。
const MiniDeskToy = lazy(() =>
  import('./components/MiniDeskToy').then((m) => ({ default: m.MiniDeskToy })),
)
import { SettingsDialog } from './components/SettingsDialog'
import { ReminderWatcher } from './components/ReminderWatcher'
import { ReminderDialog } from './components/ReminderDialog'
import {
  IconCheck,
  IconBuild,
  IconMiniWidget,
  IconSettings,
  IconShowcase,
  IconStats,
  IconToday,
  IconWinClose,
  IconWinMax,
  IconWinMin,
  IconWinRestore,
} from './components/Icons'
import logoUrl from './assets/logo-mark.svg'
import { usePlatform } from './platform'
import { notify } from './platform/notify'
import { BottomTabBar, type MobileTab } from './components/BottomTabBar'
import { habitMetOnDay } from './logic/checkin'
import { useTodayKey } from './logic/useTodayKey'
import {
  MINI_PRESETS,
  clampMiniPosition,
  defaultMiniPosition,
  loadWindowLayout,
  saveWindowLayout,
  type MiniSize,
} from './platform/miniWindow'

type Tab = MobileTab

const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * 专注相位（摆件 / 托盘共用）：只有存在会话时才按 1s 心跳；
 * 返回值只在相位变化时改变，调用方可以把它放进 effect 依赖而不触发每秒副作用。
 */
function useFocusPhase(): FocusPhase | null {
  const sessions = useTimerStore((s) => s.sessions)
  const hasSession = Object.keys(sessions).length > 0
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!hasSession) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasSession])
  if (!hasSession) return null
  const id = primarySessionId(sessions, now)
  return id ? viewSession(sessions[id], now).phase : null
}

/**
 * 专注到点提醒（B2 / D-20261110-064）：
 * - 绝对时间判定（应用隐藏/最小化/退出都不暂停）；
 * - 到点只提醒一次，并且 **先把 notifiedAt 落盘再弹**：重启后不重复通知；
 * - 顺带 prune：已删除/已归档习惯的会话、超过 TTL 的过期会话都清掉；
 * - 不自动打卡（数据诚实），确认落块在摆件/今日页由用户完成。
 */
function TimerWatcher() {
  const { t } = useI18n()
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
      for (const [habitId, session] of Object.entries(useTimerStore.getState().sessions)) {
        if (session.notifiedAt) continue
        if (viewSession(session, now).phase !== 'ready') continue
        const habit = currentHabits.find((h) => h.id === habitId)
        if (!habit || habit.archivedAt) continue
        // 先落盘再去弹：即使进程立刻被杀，重开也不会重复通知
        useTimerStore.getState().markNotified(habitId, now)
        const msg = tRef.current.focusCompanion.notificationBody(habit.name)
        toastRef.current(msg, 5200)
        void notify('BlockHabit', msg)
      }
    }
    scan()
    const timer = window.setInterval(scan, 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!toast) return null
  return (
    <div className="toast" style={{ bottom: 150, maxWidth: '80vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <span className="accent" style={{ color: 'var(--progress-green)', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginRight: 5 }}>
        <IconCheck size={14} />
      </span>
      {toast}
    </div>
  )
}

/** 托盘状态同步：tooltip 显示今日进度，当日打卡完成后托盘图标整体变绿 */
function TraySync() {
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
    if (focusPhase === 'focusing') {
      status += ` · ${t.focusCompanion.focusing}`
    } else if (focusPhase === 'ready') {
      status += ` · ${t.focusCompanion.ready}`
    }
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('update_tray', { status })
    })()
  }, [habits, checkIns, dayClaims, builds, activeBlueprintId, lang, t, day, pendingReminders, focusPhase])

  return null
}

/** 自定义窗口标题栏：拖拽区 + 设置 + 最小化/最大化/关闭（仅 Tauri 环境显示窗口按钮） */
function TitleBar({
  onSettings,
  onToggleMini,
  onRequestClose,
}: {
  onSettings: () => void
  onToggleMini: () => void
  /** 关闭请求（Alt+F4 / 系统关闭 / 标题栏关闭）：由 App 决定是否先退出迷你模式 */
  onRequestClose: () => void
}) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)
  const onRequestCloseRef = useRef(onRequestClose)
  onRequestCloseRef.current = onRequestClose
  useEffect(() => {
    if (!inTauri) return
    let disposed = false
    let cleanup: (() => void) | undefined
    void (async () => {
      const win = getCurrentWindow()
      setMaximized(await win.isMaximized())
      const unlistenResize = await listen('tauri://resize', async () => {
        setMaximized(await win.isMaximized())
      })
      // Alt+F4 / 系统关闭请求 → 收进托盘而不是退出（迷你模式下先退出迷你尺寸）
      const unClose = await win.onCloseRequested(async (event) => {
        event.preventDefault()
        onRequestCloseRef.current()
      })
      if (disposed) {
        unlistenResize()
        unClose()
        return
      }
      cleanup = () => {
        unlistenResize()
        unClose()
      }
    })()
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  async function winAction(action: 'min' | 'max' | 'close') {
    if (!inTauri) return
    const win = getCurrentWindow()
    // 最小化 → 收到任务栏；关闭 → 收进托盘（退出只走托盘菜单）
    if (action === 'close') onRequestClose()
    else if (action === 'min') await win.minimize()
    else await win.toggleMaximize()
  }

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <img src={logoUrl} alt="" width={24} height={24} data-tauri-drag-region />
        <span data-tauri-drag-region style={{ fontFamily: "'Rubik', sans-serif", fontWeight: 700 }}>BlockHabit</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="icon-btn" title={t.titlebar.miniMode} onClick={onToggleMini}>
          <IconMiniWidget size={18} />
        </button>
        <button className="icon-btn" title={t.titlebar.settings} onClick={onSettings}>
          <IconSettings size={20} />
        </button>
        {inTauri && (
          <>
            <button className="win-btn" title={t.titlebar.minimize} onClick={() => void winAction('min')}>
              <IconWinMin size={16} />
            </button>
            <button
              className="win-btn"
              title={maximized ? t.titlebar.restore : t.titlebar.maximize}
              onClick={() => void winAction('max')}
            >
              {maximized ? <IconWinRestore size={16} /> : <IconWinMax size={16} />}
            </button>
            <button className="win-btn close" title={t.titlebar.close} onClick={() => void winAction('close')}>
              <IconWinClose size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

export default function App() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>(() => {
    const tParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null
    return tParam === 'build' || tParam === 'showcase' || tParam === 'stats' ? tParam : 'today'
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [miniMode, setMiniMode] = useState(false)
  // 提醒「开始打卡」：跳到 Today 并高亮该习惯卡片
  const [focusHabitId, setFocusHabitId] = useState<string | null>(null)
  const [reminderToast, showReminderToast] = useTransient<string>(2400)
  const { isMobile } = usePlatform()
  const hydrated = useAppStore((s) => s.hydrated)
  const miniWidgetSize = useAppStore((s) => s.settings.miniWidgetSize ?? 'standard')
  const miniWidgetAlwaysOnTop = useAppStore((s) => s.settings.miniWidgetAlwaysOnTop === true)
  const updateSettings = useAppStore((s) => s.updateSettings)
  // 演示模式没有磁盘存档，main.tsx 已同步注入内存态，视作已就绪
  const ready = hydrated || isDemoMode()
  const habits = useAppStore((s) => s.habits)
  const checkIns = useAppStore((s) => s.checkIns)
  const builds = useAppStore((s) => s.builds)
  const activeBlueprintId = useAppStore((s) => s.activeBlueprintId)

  const day = useTodayKey()
  const activeHabits = habits.filter((h) => !h.archivedAt)
  const hasUnfinishedToday =
    activeHabits.length > 0 &&
    activeHabits.some((h) => !habitMetOnDay(h, checkIns, day))

  const bp = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const buildProgressPercent =
    bp.blocks.length > 0 ? Math.round((placedCount / bp.blocks.length) * 100) : 0

  const miniModeRef = useRef(false)
  miniModeRef.current = miniMode

  /** 进入/退出迷你摆件（D-20261110-059）：三档 preset + 显式最小尺寸 + 位置钳制 */
  async function toggleMini(enable: boolean, sizeOverride?: MiniSize) {
    const size = sizeOverride ?? useAppStore.getState().settings.miniWidgetSize ?? 'standard'
    const preset = MINI_PRESETS[size]
    const wasMini = miniModeRef.current
    setMiniMode(enable)
    if (!inTauri) {
      updateSettings(enable ? { enableMiniWidget: true, miniWidgetSize: size } : { enableMiniWidget: false })
      return
    }
    const win = getCurrentWindow()
    if (enable) {
      if (!wasMini) {
        // 记录主窗尺寸/位置（逻辑像素），退出时恢复
        const outer = await win.outerSize()
        const pos = await win.outerPosition().catch(() => null)
        const f = (await win.scaleFactor()) || 1
        const layout = loadWindowLayout()
        saveWindowLayout({
          ...layout,
          main: {
            w: Math.round(outer.width / f),
            h: Math.round(outer.height / f),
            ...(pos ? { x: Math.round(pos.x / f), y: Math.round(pos.y / f) } : {}),
          },
        })
      }
      // 显式最小尺寸契约：先 setMinSize 再 setSize，不依赖 tauri.conf 的 900×600 隐式行为
      await win.setMinSize(new LogicalSize(preset.w, preset.h)).catch(() => {})
      await win.setSize(new LogicalSize(preset.w, preset.h))
      const monitor = (await currentMonitor().catch(() => null)) ?? (await primaryMonitor().catch(() => null))
      let point = loadWindowLayout().mini ?? null
      if (monitor) {
        const f = monitor.scaleFactor || 1
        const area = {
          x: monitor.workArea.position.x / f,
          y: monitor.workArea.position.y / f,
          width: monitor.workArea.size.width / f,
          height: monitor.workArea.size.height / f,
        }
        point = clampMiniPosition(point ?? defaultMiniPosition(area, preset), area, preset)
        await win.setPosition(new LogicalPosition(point.x, point.y)).catch(() => {})
      } else if (point) {
        await win.setPosition(new LogicalPosition(point.x, point.y)).catch(() => {})
      }
      await win
        .setAlwaysOnTop(useAppStore.getState().settings.miniWidgetAlwaysOnTop === true)
        .catch(() => {})
      await win.setResizable(false)
      saveWindowLayout({ ...loadWindowLayout(), mini: point ?? undefined })
      updateSettings({ enableMiniWidget: true, miniWidgetSize: size })
    } else {
      const main = loadWindowLayout().main ?? { w: 1100, h: 760 }
      await win.setResizable(true)
      await win.setMinSize(new LogicalSize(900, 600)).catch(() => {})
      await win.setSize(new LogicalSize(main.w, main.h))
      await win.setAlwaysOnTop(false)
      if (main.x !== undefined && main.y !== undefined) {
        await win.setPosition(new LogicalPosition(main.x, main.y)).catch(() => {})
      } else {
        await win.center()
      }
      updateSettings({ enableMiniWidget: false })
    }
  }

  /** 摆件置顶开关：设置持久化 + 当前窗口即时生效 */
  function toggleMiniPin() {
    const next = !useAppStore.getState().settings.miniWidgetAlwaysOnTop
    updateSettings({ miniWidgetAlwaysOnTop: next })
    if (inTauri && miniModeRef.current) void getCurrentWindow().setAlwaysOnTop(next).catch(() => {})
  }

  // 摆件使用中改尺寸：即时应用到当前窗口（不经过进入/退出流程）
  useEffect(() => {
    if (!inTauri || !miniModeRef.current) return
    const win = getCurrentWindow()
    const preset = MINI_PRESETS[miniWidgetSize]
    void (async () => {
      await win.setMinSize(new LogicalSize(preset.w, preset.h)).catch(() => {})
      await win.setSize(new LogicalSize(preset.w, preset.h))
    })()
  }, [miniWidgetSize])

  // 摆件使用中切换置顶：即时应用
  useEffect(() => {
    if (!inTauri || !miniModeRef.current) return
    void getCurrentWindow().setAlwaysOnTop(miniWidgetAlwaysOnTop).catch(() => {})
  }, [miniWidgetAlwaysOnTop])

  // 摆件拖动后持久化位置（独立验证 P2-2）：节流 400ms，只存设备本地
  useEffect(() => {
    if (!inTauri || !miniMode) return
    const win = getCurrentWindow()
    let timer: number | undefined
    let disposed = false
    const persistPosition = async () => {
      const f = (await win.scaleFactor().catch(() => 1)) || 1
      const pos = await win.outerPosition().catch(() => null)
      if (!pos || disposed) return
      const layout = loadWindowLayout()
      saveWindowLayout({
        ...layout,
        mini: { x: Math.round(pos.x / f), y: Math.round(pos.y / f) },
      })
    }
    const schedule = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => void persistPosition(), 400)
    }
    const unlistenPromise = win.onMoved(schedule)
    return () => {
      disposed = true
      if (timer) window.clearTimeout(timer)
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {})
    }
  }, [miniMode])

  /**
   * A10：窗口关闭请求。
   * 迷你悬浮件是不可调整大小的 260×380 置顶窗，如果直接隐藏，下次从托盘唤起仍卡在迷你尺寸。
   * 因此迷你模式下关闭 = 先退出迷你模式（恢复尺寸/可调整），再收进托盘。
   */
  async function handleWindowCloseRequest(): Promise<void> {
    if (!inTauri) return
    const win = getCurrentWindow()
    if (miniModeRef.current) {
      await toggleMini(false)
    }
    await win.hide()
  }

  useEffect(() => {
    void initPersistence(pickAdapter())
  }, [])
  // 常驻悬浮件：hydration 完成后按设置自动进入迷你模式（手动退出时写回 false，下次不再自启）
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await persistenceReady
      if (cancelled) return
      if (useAppStore.getState().settings.enableMiniWidget === true && !miniMode) {
        void toggleMini(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // 仅挂载时判定一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // 静音开关持久化：settings.soundMuted 单向驱动音频引擎
  const soundMutedSetting = useAppStore((s) => s.settings.soundMuted)
  useEffect(() => {
    setSoundMuted(soundMutedSetting === true)
  }, [soundMutedSetting])
  const volumeSetting = useAppStore((s) => s.settings.volume)
  useEffect(() => {
    setVolume(typeof volumeSetting === 'number' ? volumeSetting : 100)
  }, [volumeSetting])

  // 主题/语言副作用：store 只存状态，DOM 与跨窗口事件由这里驱动
  const themeSetting = useAppStore((s) => s.settings.theme)
  const langSetting = useAppStore((s) => s.settings.language)
  useEffect(() => {
    document.documentElement.dataset.theme = themeSetting
    clearCubeSpriteCache()
  }, [themeSetting])
  useEffect(() => {
    document.documentElement.lang = langSetting
  }, [langSetting])
  // 回写首帧缓存（main.tsx 在 React 挂载前读取），消除下次启动的主题/语言闪变
  useEffect(() => {
    cacheAppearance(themeSetting, langSetting)
  }, [themeSetting, langSetting])
  useEffect(() => {
    if (!inTauri) return
    void import('@tauri-apps/api/event').then(({ emit }) => emit('theme-changed', themeSetting))
  }, [themeSetting])
  useEffect(() => {
    if (!inTauri) return
    void import('@tauri-apps/api/event').then(({ emit }) => emit('language-changed', langSetting))
  }, [langSetting])

  // 存档保存失败感知：首次失败弹提示，10s 去抖避免持续失败时轰炸
  const saveError = useAppStore((s) => s.saveError)
  const [saveErrorVisible, setSaveErrorVisible] = useState(false)
  const saveErrorShownAtRef = useRef(0)
  useEffect(() => {
    if (!saveError) {
      setSaveErrorVisible(false)
      return
    }
    if (Date.now() - saveErrorShownAtRef.current > 10_000) {
      saveErrorShownAtRef.current = Date.now()
      setSaveErrorVisible(true)
    }
  }, [saveError])

  // 存档来自更高版本：本会话挂起持久化，提示用户升级
  const needsUpgrade = useAppStore((s) => s.needsUpgrade)
  // 读档失败：本会话已挂起持久化（避免空态覆盖真实存档），必须让用户知道
  const loadFailed = useAppStore((s) => s.loadFailed)
  // 存档损坏：原文已备份，必须以空态启动但提示用户
  const dataCorrupt = useAppStore((s) => s.dataCorrupt)

  // 托盘退出握手：Rust 发起退出 → 前端 flush 存档 → 确认 → Rust 退出（1.5s 超时强退兜底）
  useEffect(() => {
    if (!inTauri) return
    let disposed = false
    let stop: (() => void) | undefined
    void (async () => {
      const unlisten = await listen('app-quit-requested', () => {
        void (async () => {
          // 等待 flush 的写入真正完成（含 Tauri 端 rename）后再放行退出
          try {
            await forceFlush()
          } finally {
            try {
              const { invoke } = await import('@tauri-apps/api/core')
              await invoke('confirm_quit')
            } catch {
              // Rust 侧超时强退兜底
            }
          }
        })()
      })
      if (disposed) unlisten()
      else stop = unlisten
    })()
    return () => {
      disposed = true
      stop?.()
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return
      // 弹窗打开时不响应数字键切页
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (e.key === '1') setTab('today')
      else if (e.key === '2') setTab('build')
      else if (e.key === '3') setTab('showcase')
      else if (e.key === '4') setTab('stats')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tabs: Array<[Tab, string, ComponentType<{ size?: number }>]> = [
    ['today', t.nav.today, IconToday],
    ['build', t.nav.build, IconBuild],
    ['showcase', t.nav.showcase, IconShowcase],
    ['stats', t.nav.stats, IconStats],
  ]
  // 水合门（D-20261110-056）：读档完成前不渲染空态，避免「空态一闪 → 真实习惯」的闪变
  if (!ready) {
    return <div className="app" aria-busy="true" />
  }

  if (miniMode) {
    // 浏览器预览没有真实窗口，用预设尺寸居中模拟，便于开发/验收三档视觉；Tauri 下铺满真实窗口
    const preview = MINI_PRESETS[miniWidgetSize]
    return (
      <div
        className="app"
        style={{
          height: '100vh',
          padding: 0,
          background: 'var(--bg)',
          display: inTauri ? 'block' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={
            inTauri
              ? { height: '100vh' }
              : { width: preview.w, height: preview.h, maxWidth: '100vw', maxHeight: '100vh' }
          }
        >
          <Suspense fallback={<div style={{ height: '100vh', background: 'var(--bg)' }} />}>
            <MiniDeskToy
              size={miniWidgetSize}
              pinned={miniWidgetAlwaysOnTop}
              onTogglePin={toggleMiniPin}
              onExpand={() => void toggleMini(false)}
              onClose={async () => {
                // 关闭 = 先恢复主窗再收托盘，避免下次从托盘唤起仍卡在迷你尺寸
                await toggleMini(false)
                if (inTauri) await getCurrentWindow().hide()
              }}
            />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className={`app ${isMobile ? 'mobile-app-root' : ''}`}>
      {isMobile ? (
        <header
          className="mobile-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 'max(12px, var(--sat))',
            paddingBottom: '12px',
            paddingLeft: '16px',
            paddingRight: '16px',
            background: 'color-mix(in srgb, var(--surface) 85%, transparent)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--line)',
            flexShrink: 0,
            zIndex: 80,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logoUrl} alt="BlockHabit" width={24} height={24} />
            <span style={{ fontSize: 'var(--fs-title)', fontWeight: 700, fontFamily: "'Rubik', sans-serif" }}>
              {tabs.find(([id]) => id === tab)?.[1] ?? 'BlockHabit'}
            </span>
          </div>
          <button
            className="icon-btn"
            title={t.titlebar.settings}
            aria-label={t.titlebar.settings}
            onClick={() => setSettingsOpen(true)}
            style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <IconSettings size={20} />
          </button>
        </header>
      ) : (
        <TitleBar
          onSettings={() => setSettingsOpen(true)}
          onToggleMini={() => void toggleMini(true, miniWidgetSize)}
          onRequestClose={() => void handleWindowCloseRequest()}
        />
      )}
      {inTauri && <TraySync />}
      <TimerWatcher />
      <ReminderWatcher />
      <main
        className={`content ${isMobile ? 'mobile-content-area' : ''}`}
        style={isMobile ? { paddingTop: 12 } : undefined}
      >
        {tab === 'today' && (
          <Today
            onCelebrate={() => setTab('build')}
            onGoBuild={() => setTab('build')}
            focusHabitId={focusHabitId}
            onFocusConsumed={() => setFocusHabitId(null)}
          />
        )}
        {tab === 'build' && <Build />}
        {tab === 'showcase' && <Showcase />}
        {tab === 'stats' && <Stats />}
      </main>
      {isMobile ? (
        <BottomTabBar
          currentTab={tab}
          onChange={(nextTab) => setTab(nextTab)}
          hasUnfinishedToday={hasUnfinishedToday}
          buildProgressPercent={buildProgressPercent}
        />
      ) : (
        <nav className="tabbar">
          {tabs.map(([id, label, Icon], index) => (
            <button
              key={id}
              className={tab === id ? 'active' : ''}
              title={t.common.shortcut(label, String(index + 1))}
              onClick={() => setTab(id)}
            >
              <Icon size={21} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {needsUpgrade && (
        <div className="toast" style={{ zIndex: 2000, whiteSpace: 'normal', maxWidth: '80vw' }}>
          {t.settings.needsUpgradeToast}
        </div>
      )}
      {saveErrorVisible && (
        <div className="toast" style={{ zIndex: 2000 }}>{t.settings.saveFailedToast}</div>
      )}
      {loadFailed && (
        <div className="toast" style={{ zIndex: 2000, whiteSpace: 'normal', maxWidth: '80vw' }}>
          {t.settings.loadFailedToast}
        </div>
      )}
      {dataCorrupt && (
        <div className="toast" style={{ zIndex: 2000, whiteSpace: 'normal', maxWidth: '80vw' }}>
          {t.settings.corruptRecoveredToast}
        </div>
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <ReminderDialog
        onStart={(habitId) => {
          setTab('today')
          setFocusHabitId(habitId)
        }}
        onToast={(text) => {
          showReminderToast(text, 2400)
        }}
      />
      {reminderToast && <div className="toast">{reminderToast}</div>}
    </div>
  )
}
