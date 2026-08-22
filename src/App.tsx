import { useEffect, useState, type ComponentType } from 'react'
import { initPersistence } from './store/appStore'
import { pickAdapter } from './storage'
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
    })()
    return () => unlisten?.()
  }, [])

  async function winAction(action: 'min' | 'max' | 'close') {
    if (!inTauri) return
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    if (action === 'min') await win.minimize()
    else if (action === 'max') await win.toggleMaximize()
    else await win.close()
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
