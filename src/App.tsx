import { useEffect, useState, type ComponentType } from 'react'
import { initPersistence, useAppStore } from './store/appStore'
import { pickAdapter } from './storage'
import { getBlueprint } from './logic/blueprints'
import { todayKey } from './logic/dates'
import Today from './pages/Today'
import Build from './pages/Build'
import Stats from './pages/Stats'
import { SettingsDialog } from './components/SettingsDialog'
import {
  IconBuild,
  IconSettings,
  IconStats,
  IconToday,
  IconWinClose,
  IconWinMax,
  IconWinMin,
  IconWinRestore,
} from './components/Icons'
import logoUrl from './assets/logo-mark.svg'

type Tab = 'today' | 'build' | 'stats'

const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** 托盘状态同步：tooltip 显示今日进度，当日打卡完成后托盘图标整体变绿 */
function TraySync() {
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
    const status = claimed
      ? '今日已打卡 ✓'
      : `今日 ${done}/${active.length} · ${bp.name} ${placed}/${bp.blocks.length}`
    void (async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('update_tray', { status, done: claimed })
    })()
  }, [habits, checkIns, dayClaims, builds, activeBlueprintId])

  return null
}

/** 自定义窗口标题栏：拖拽区 + 设置 + 最小化/最大化/关闭（仅 Tauri 环境显示窗口按钮） */
function TitleBar({ onSettings }: { onSettings: () => void }) {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!inTauri) return
    let unlisten: (() => void) | undefined
    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      setMaximized(await win.isMaximized())
      const { listen } = await import('@tauri-apps/api/event')
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
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    // 最小化与关闭都收进托盘，退出只走托盘菜单
    if (action === 'min' || action === 'close') await win.hide()
    else await win.toggleMaximize()
  }

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        <img src={logoUrl} alt="" width={24} height={24} data-tauri-drag-region />
        <span data-tauri-drag-region>BlockHabit</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="icon-btn" title="设置" onClick={onSettings}>
          <IconSettings size={20} />
        </button>
        {inTauri && (
          <>
            <button className="win-btn" title="最小化" onClick={() => void winAction('min')}>
              <IconWinMin size={16} />
            </button>
            <button
              className="win-btn"
              title={maximized ? '还原' : '最大化'}
              onClick={() => void winAction('max')}
            >
              {maximized ? <IconWinRestore size={16} /> : <IconWinMax size={16} />}
            </button>
            <button className="win-btn close" title="关闭" onClick={() => void winAction('close')}>
              <IconWinClose size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void initPersistence(pickAdapter())
  }, [])

  const tabs: Array<[Tab, string, ComponentType<{ size?: number }>]> = [
    ['today', '今日', IconToday],
    ['build', '建造', IconBuild],
    ['stats', '统计', IconStats],
  ]

  return (
    <div className="app">
      <TitleBar onSettings={() => setSettingsOpen(true)} />
      {inTauri && <TraySync />}
      <main className="content">
        {tab === 'today' && <Today onCelebrate={() => setTab('build')} />}
        {tab === 'build' && <Build />}
        {tab === 'stats' && <Stats />}
      </main>
      <nav className="tabbar">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <Icon size={21} />
            {label}
          </button>
        ))}
      </nav>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
