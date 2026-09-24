import { useEffect, useRef, useState, type ComponentType } from 'react'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { initPersistence, useAppStore } from './store/appStore'
import { pickAdapter } from './storage'
import { getBlueprint } from './logic/blueprints'
import { todayKey } from './logic/dates'
import { useTimerStore } from './store/timerStore'
import { getBlueprintName, useI18n } from './i18n'
import Today from './pages/Today'
import Build from './pages/Build'
import Showcase from './pages/Showcase'
import Stats from './pages/Stats'
import { SettingsDialog } from './components/SettingsDialog'
import { MiniDeskToy } from './components/MiniDeskToy'
import {
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

type Tab = MobileTab

const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** 倒计时到点提醒：全局监听，toast + 系统通知 */
function TimerWatcher() {
  const { lang } = useI18n()
  const sessions = useTimerStore((s) => s.sessions)
  const [toast, setToast] = useState<string | null>(null)
  const notified = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (Object.keys(sessions).length === 0) return
    const t = setInterval(() => {
      const nowMs = Date.now()
      for (const [id, s] of Object.entries(sessions)) {
        if (nowMs - s.startedAt >= s.targetMs && !notified.current.has(id)) {
          notified.current.add(id)
          const name = useAppStore.getState().habits.find((h) => h.id === id)?.name ?? 'Habit'
          const msg =
            lang === 'zh'
              ? `「${name}」计时完成，回到卡片点击打卡`
              : `"${name}" focus completed! Click card to check in`
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
    return () => clearInterval(t)
  }, [sessions, lang])

  if (!toast) return null
  return (
    <div className="toast" style={{ bottom: 150, maxWidth: '80vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <span className="accent" style={{ color: 'var(--progress-green)' }}>✓ </span>
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

  useEffect(() => {
    if (!inTauri) return
    const day = todayKey()
    const active = habits.filter((h) => !h.archivedAt)
    const done = active.filter((h) => checkIns.some((c) => c.habitId === h.id && c.date === day)).length
    const claimed = dayClaims.includes(day)
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
  }, [habits, checkIns, dayClaims, builds, activeBlueprintId, lang, t])

  return null
}

/** 自定义窗口标题栏：拖拽区 + 设置 + 最小化/最大化/关闭（仅 Tauri 环境显示窗口按钮） */
function TitleBar({ onSettings, onToggleMini }: { onSettings: () => void; onToggleMini: () => void }) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    if (!inTauri) return
    let unlisten: (() => void) | undefined
    void (async () => {
      const win = getCurrentWindow()
      setMaximized(await win.isMaximized())
      unlisten = await listen('tauri://resize', async () => {
        setMaximized(await win.isMaximized())
      })
      // Alt+F4 / 系统关闭请求 → 收进托盘而不是退出
      const unClose = await win.onCloseRequested(async (event) => {
        event.preventDefault()
        await win.hide()
      })
      const prev = unlisten
      unlisten = () => {
        prev?.()
        unClose()
      }
    })()
    return () => unlisten?.()
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

  const day = todayKey()
  const activeHabits = habits.filter((h) => !h.archivedAt)
  const hasUnfinishedToday =
    activeHabits.length > 0 &&
    activeHabits.some((h) => !habitMetOnDay(h, checkIns, day))

  const bp = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const buildProgressPercent =
    bp.blocks.length > 0 ? Math.round((placedCount / bp.blocks.length) * 100) : 0

  async function toggleMini(enable: boolean) {
    setMiniMode(enable)
    if (inTauri) {
      const win = getCurrentWindow()
      if (enable) {
        await win.setSize(new LogicalSize(260, 380))
        await win.setAlwaysOnTop(true)
        await win.setResizable(false)
      } else {
        await win.setSize(new LogicalSize(1100, 760))
        await win.setAlwaysOnTop(false)
        await win.setResizable(true)
        await win.center()
      }
    }
  }
  useEffect(() => {
    void initPersistence(pickAdapter())
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
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
            onClick={() => setSettingsOpen(true)}
            style={{ width: 36, height: 36 }}
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
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
