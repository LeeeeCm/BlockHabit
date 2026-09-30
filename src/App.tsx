import { useEffect, useRef, useState, type ComponentType } from 'react'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { initPersistence, useAppStore, forceFlush } from './store/appStore'
import { pickAdapter } from './storage'
import { setSoundMuted } from './audio/sound'
import { getBlueprint } from './logic/blueprints'
import { useTimerStore } from './store/timerStore'
import { getBlueprintName, useI18n } from './i18n'
import Today from './pages/Today'
import Build from './pages/Build'
import Showcase from './pages/Showcase'
import Stats from './pages/Stats'
import { SettingsDialog } from './components/SettingsDialog'
import { MiniDeskToy } from './components/MiniDeskToy'
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
import { BottomTabBar, type MobileTab } from './components/BottomTabBar'
import { habitMetOnDay } from './logic/checkin'
import { useTodayKey } from './logic/useTodayKey'

type Tab = MobileTab

const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** 倒计时到点提醒：全局监听，toast + 系统通知 */
function TimerWatcher() {
  const { t } = useI18n()
  const sessions = useTimerStore((s) => s.sessions)
  const [toast, setToast] = useState<string | null>(null)
  const notified = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (Object.keys(sessions).length === 0) {
      notified.current.clear()
      return
    }
    // 清理已结束的旧 session 标记，防止同一习惯下次计时被永久静音
    const activeKeys = new Set(Object.entries(sessions).map(([id, s]) => `${id}_${s.startedAt}`))
    for (const key of Array.from(notified.current)) {
      if (!activeKeys.has(key)) {
        notified.current.delete(key)
      }
    }

    const timer = setInterval(() => {
      const nowMs = Date.now()
      for (const [id, s] of Object.entries(sessions)) {
        const sessionKey = `${id}_${s.startedAt}`
        if (nowMs - s.startedAt >= s.targetMs && !notified.current.has(sessionKey)) {
          notified.current.add(sessionKey)
          const name = useAppStore.getState().habits.find((h) => h.id === id)?.name ?? 'Habit'
          const msg = t.today.timerDoneNotify(name)
          setToast(msg)
          try {
            new Notification('BlockHabit', { body: msg })
          } catch {
            /* WebView 未授权系统通知时静默降级为应用内提醒 */
          }
          setTimeout(() => setToast(null), 5200)
        }
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [sessions, t])

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
    const status = claimed
      ? t.tray.tooltipDone
      : `${t.tray.tooltipProgress(done, active.length)} · ${bpName} ${placed}/${bp.blocks.length}`
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('update_tray', { status })
    })()
  }, [habits, checkIns, dayClaims, builds, activeBlueprintId, lang, t, day])

  return null
}

/** 自定义窗口标题栏：拖拽区 + 设置 + 最小化/最大化/关闭（仅 Tauri 环境显示窗口按钮） */
function TitleBar({ onSettings, onToggleMini }: { onSettings: () => void; onToggleMini: () => void }) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)
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
      // Alt+F4 / 系统关闭请求 → 收进托盘而不是退出
      const unClose = await win.onCloseRequested(async (event) => {
        event.preventDefault()
        await win.hide()
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
    if (action === 'close') await win.hide()
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
  const { isMobile } = usePlatform()
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

  // 进入迷你模式前的原始窗口尺寸（退出时恢复）
  const preMiniSizeRef = useRef<{ width: number; height: number } | null>(null)

  async function toggleMini(enable: boolean) {
    setMiniMode(enable)
    if (inTauri) {
      const win = getCurrentWindow()
      if (enable) {
        // 记录原始窗口尺寸（outerSize 是物理像素，换算为逻辑像素供恢复用）
        const size = await win.outerSize()
        const f = await win.scaleFactor()
        preMiniSizeRef.current = { width: Math.round(size.width / f), height: Math.round(size.height / f) }
        await win.setSize(new LogicalSize(260, 380))
        await win.setAlwaysOnTop(true)
        await win.setResizable(false)
      } else {
        const prev = preMiniSizeRef.current
        await win.setSize(new LogicalSize(prev?.width ?? 1100, prev?.height ?? 760))
        preMiniSizeRef.current = null
        await win.setAlwaysOnTop(false)
        await win.setResizable(true)
        await win.center()
      }
    }
  }
  useEffect(() => {
    void initPersistence(pickAdapter())
  }, [])
  // 静音开关持久化：settings.soundMuted 单向驱动音频引擎
  const soundMutedSetting = useAppStore((s) => s.settings.soundMuted)
  useEffect(() => {
    setSoundMuted(soundMutedSetting === true)
  }, [soundMutedSetting])

  // 主题/语言副作用：store 只存状态，DOM 与跨窗口事件由这里驱动
  const themeSetting = useAppStore((s) => s.settings.theme)
  const langSetting = useAppStore((s) => s.settings.language)
  useEffect(() => {
    document.documentElement.dataset.theme = themeSetting
  }, [themeSetting])
  useEffect(() => {
    document.documentElement.lang = langSetting
  }, [langSetting])
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
  if (miniMode) {
    return (
      <div className="app" style={{ height: '100vh', padding: 0 }}>
        <MiniDeskToy
          onExpand={() => void toggleMini(false)}
          onClose={async () => {
            if (inTauri) {
              await getCurrentWindow().hide()
            } else {
              void toggleMini(false)
            }
          }}
        />
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
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Rubik', sans-serif" }}>
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
        <TitleBar onSettings={() => setSettingsOpen(true)} onToggleMini={() => void toggleMini(true)} />
      )}
      {inTauri && <TraySync />}
      <TimerWatcher />
      <main
        className={`content ${isMobile ? 'mobile-content-area' : ''}`}
        style={isMobile ? { paddingTop: 12 } : undefined}
      >
        {tab === 'today' && <Today onCelebrate={() => setTab('build')} />}
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
          {tabs.map(([id, label, Icon]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
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
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
