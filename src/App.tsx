import { useEffect, useState } from 'react'
import { initPersistence } from './store/appStore'
import { createLocalStorageAdapter } from './storage/adapter'
import Today from './pages/Today'
import Build from './pages/Build'
import Stats from './pages/Stats'
import { SettingsDialog } from './components/SettingsDialog'

type Tab = 'today' | 'build' | 'stats'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void initPersistence(createLocalStorageAdapter())
  }, [])

  const tabs: Array<[Tab, string]> = [
    ['today', '今日'],
    ['build', '建造'],
    ['stats', '统计'],
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">BlockHabit</div>
        <button className="icon-btn" title="设置" onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
      </header>
      <main className="content">
        {tab === 'today' && <Today />}
        {tab === 'build' && <Build />}
        {tab === 'stats' && <Stats />}
      </main>
      <nav className="tabbar">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
