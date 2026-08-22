import { useEffect, useState, type ComponentType } from 'react'
import { initPersistence } from './store/appStore'
import { pickAdapter } from './storage'
import Today from './pages/Today'
import Build from './pages/Build'
import Stats from './pages/Stats'
import { SettingsDialog } from './components/SettingsDialog'
import { IconBuild, IconSettings, IconStats, IconToday } from './components/Icons'
import logoUrl from './assets/logo-mark.svg'

type Tab = 'today' | 'build' | 'stats'

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
      <header className="topbar">
        <div className="brand">
          <img src={logoUrl} alt="" width={26} height={26} />
          BlockHabit
        </div>
        <button className="icon-btn" title="设置" onClick={() => setSettingsOpen(true)}>
          <IconSettings size={21} />
        </button>
      </header>
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
