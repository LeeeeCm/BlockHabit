import { clearCubeSpriteCache } from './render/isoCube'
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useTransient } from './platform/useTransient'
import { inTauri } from './app/inTauri'
import { TimerWatcher } from './app/TimerWatcher'
import { TitleBar } from './app/TitleBar'
import { TraySync } from './app/TraySync'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen, emitTo } from '@tauri-apps/api/event'
import { setPetVisible } from './platform/petWindow'
import type { PetConfig } from './pet/types'
import { normalizePetColor, PET_MODELS, resolvePetModel } from './pet/types'
import { initPersistence, useAppStore, forceFlush, isDemoMode } from './store/appStore'
import { cacheAppearance } from './platform/appearance'
import { pickAdapter } from './storage'
import { setSoundMuted, setVolume } from './audio/sound'
import { getBlueprint } from './logic/blueprints'
import { useI18n } from './i18n'
import Today from './pages/Today'
import Build from './pages/Build'
import Showcase from './pages/Showcase'
import Stats from './pages/Stats'

// D-20261110-056 追加修正：页面用 React.lazy 会带来首次切页 ~300ms 的 Suspense 延迟提交
// （见 .tmp-perf/report.md §5）；改为静态 import，换取切页即时。
import { SettingsDialog } from './components/SettingsDialog'
import { ReminderWatcher } from './components/ReminderWatcher'
import { ReminderDialog } from './components/ReminderDialog'
import { IconBuild, IconSettings, IconShowcase, IconStats, IconToday } from './components/Icons'
import logoUrl from './assets/logo-mark.svg'
import { usePlatform } from './platform'
import { BottomTabBar, type MobileTab } from './components/BottomTabBar'
import { habitMetOnDay } from './logic/checkin'
import { useTodayKey } from './logic/useTodayKey'
import { registerQuickCheckIn, unregisterQuickCheckIn } from './platform/globalShortcut'
import type { AppSettings } from './types'

type Tab = MobileTab

export default function App() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>(() => {
    const tParam =
      typeof location !== 'undefined' ? new URLSearchParams(location.search).get('tab') : null
    return tParam === 'build' || tParam === 'showcase' || tParam === 'stats' ? tParam : 'today'
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focusPetSettings, setFocusPetSettings] = useState(false)
  // 提醒「开始打卡」：跳到 Today 并高亮该习惯卡片
  const [focusHabitId, setFocusHabitId] = useState<string | null>(null)
  const [reminderToast, showReminderToast] = useTransient<string>(2400)
  const { isMobile } = usePlatform()
  const hydrated = useAppStore((s) => s.hydrated)
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
    activeHabits.length > 0 && activeHabits.some((h) => !habitMetOnDay(h, checkIns, day))

  const bp = getBlueprint(activeBlueprintId)
  const placedCount = builds.filter((b) => b.blueprintId === activeBlueprintId).length
  const buildProgressPercent =
    bp.blocks.length > 0 ? Math.round((placedCount / bp.blocks.length) * 100) : 0

  /** 打开设置 */
  function openSettings() {
    setFocusPetSettings(false)
    setSettingsOpen(true)
  }

  async function handleWindowCloseRequest(): Promise<void> {
    if (!inTauri) return
    const win = getCurrentWindow()
    await win.hide()
  }

  useEffect(() => {
    void initPersistence(pickAdapter())
  }, [])

  // D-20261124-091：桌宠可见性与配置由主窗驱动；pet 窗口只负责绘制与交互。
  const enablePet = useAppStore((s) => s.settings.enablePet !== false)
  const petSize = useAppStore((s) => s.settings.petSize ?? 'medium')
  const petSkin = useAppStore((s) => s.settings.petSkin ?? s.settings.petModel ?? 'block')
  const resolvedPetSkin = resolvePetModel(petSkin, builds)
  const unlockedPetSkins = PET_MODELS.filter((model) => resolvePetModel(model, builds) === model)
  const unlockedPetKey = unlockedPetSkins.join(',')
  const petRoam = useAppStore((s) => s.settings.petRoam !== false)
  const petColor = useAppStore((s) => s.settings.petColor)
  const completedCount = useAppStore((s) => s.completedBlueprintIds.length)
  const petDone = activeHabits.filter((h) => habitMetOnDay(h, checkIns, day)).length
  useEffect(() => {
    if (!inTauri) return
    // 窗口由 Tauri 配置创建；个别启动时序下首个 invoke 可能早于 pet 窗口就绪，补一次重试。
    void setPetVisible(enablePet)
    const retry = window.setTimeout(() => void setPetVisible(enablePet), 800)
    return () => window.clearTimeout(retry)
  }, [enablePet])
  useEffect(() => {
    if (!inTauri || !enablePet) return
    const config: PetConfig = {
      size: petSize,
      skin: resolvedPetSkin,
      roam: petRoam,
      color: petColor,
      unlocked: unlockedPetSkins,
      done: petDone,
      total: activeHabits.length,
      completed: completedCount
    }
    const send = () => {
      void emitTo('pet', 'pet-config', config).catch(() => {})
      void emitTo('pet-menu', 'pet-config', config).catch(() => {})
    }
    send()
    const late = window.setTimeout(send, 600)
    return () => window.clearTimeout(late)
  }, [
    enablePet,
    petSize,
    resolvedPetSkin,
    unlockedPetKey,
    petRoam,
    petColor,
    petDone,
    activeHabits.length,
    completedCount
  ])
  useEffect(() => {
    if (!inTauri) return
    let disposed = false
    const unlisten = listen('open-pet-settings', () => {
      if (disposed) return
      const win = getCurrentWindow()
      void win.show().catch(() => {})
      void win.unminimize().catch(() => {})
      void win.setFocus().catch(() => {})
      setFocusPetSettings(true)
      setSettingsOpen(true)
    })
    return () => {
      disposed = true
      void unlisten.then((fn) => fn()).catch(() => {})
    }
  }, [])
  // 桌宠悬浮面板改动偏好：只接受已知字段，避免跨窗口事件改写其它设置。
  useEffect(() => {
    if (!inTauri) return
    const unlisten = listen<Record<string, unknown>>('pet-pref', (event) => {
      const payload = event.payload
      if (!payload || typeof payload !== 'object') return
      const patch: Partial<AppSettings> = {}
      if (payload.size === 'small' || payload.size === 'medium' || payload.size === 'large')
        patch.petSize = payload.size
      if (payload.skin === 'block' || payload.skin === 'cat') patch.petSkin = payload.skin
      if (typeof payload.roam === 'boolean') patch.petRoam = payload.roam
      if (typeof payload.color === 'string') patch.petColor = normalizePetColor(payload.color)
      if (Object.keys(patch).length > 0) updateSettings(patch)
    })
    return () => {
      void unlisten.then((fn) => fn()).catch(() => {})
    }
  }, [updateSettings])

  // D-20261124-086：全局快捷键（默认关）。注册失败时回滚设置并如实提示。
  const quickCheckInEnabled = useAppStore((s) => s.settings.quickCheckInEnabled === true)
  useEffect(() => {
    if (!inTauri || !quickCheckInEnabled) return
    let disposed = false
    void (async () => {
      const ok = await registerQuickCheckIn(async () => {
        const win = getCurrentWindow()
        await win.show().catch(() => {})
        await win.unminimize().catch(() => {})
        await win.setFocus().catch(() => {})
        setTab('today')
      })
      if (!ok && !disposed) {
        updateSettings({ quickCheckInEnabled: false })
        showReminderToast(t.settings.quickCheckInFailed, 3200)
      }
    })()
    return () => {
      disposed = true
      void unregisterQuickCheckIn()
    }
  }, [
    inTauri,
    quickCheckInEnabled,
    updateSettings,
    showReminderToast,
    t.settings.quickCheckInFailed
  ])
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
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable)
        return
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
    ['stats', t.nav.stats, IconStats]
  ]
  // 水合门（D-20261110-056）：读档完成前不渲染空态，避免「空态一闪 → 真实习惯」的闪变
  if (!ready) {
    return <div className="app" aria-busy="true" />
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
            zIndex: 80
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logoUrl} alt="BlockHabit" width={24} height={24} />
            <span
              style={{
                fontSize: 'var(--fs-title)',
                fontWeight: 700,
                fontFamily: "'Rubik', sans-serif"
              }}
            >
              {tabs.find(([id]) => id === tab)?.[1] ?? 'BlockHabit'}
            </span>
          </div>
          <button
            className="icon-btn"
            title={t.titlebar.settings}
            aria-label={t.titlebar.settings}
            onClick={() => openSettings()}
            style={{
              width: 44,
              height: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <IconSettings size={20} />
          </button>
        </header>
      ) : (
        <TitleBar
          onSettings={() => openSettings()}
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
        <div className="toast" style={{ zIndex: 2000 }}>
          {t.settings.saveFailedToast}
        </div>
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
      {settingsOpen && (
        <SettingsDialog
          focusPet={focusPetSettings}
          onClose={() => {
            setSettingsOpen(false)
            setFocusPetSettings(false)
          }}
        />
      )}
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
