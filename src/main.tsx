import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { TrayMenu } from './components/TrayMenu'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { initSmoothScroll } from './platform/smoothScroll'
import { applyDemoCastleState, markDemoMode, useAppStore } from './store/appStore'
import '@fontsource/rubik/400.css'
import '@fontsource/rubik/500.css'
import '@fontsource/rubik/600.css'
import '@fontsource/rubik/700.css'
import 'misans/lib/Normal/MiSans-Regular.min.css'
import 'misans/lib/Normal/MiSans-Medium.min.css'
import 'misans/lib/Normal/MiSans-Semibold.min.css'
import 'misans/lib/Normal/MiSans-Bold.min.css'
import './theme.css'
import './mobile.css'
import './components/ui.css'

const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const isTrayMenu = inTauri && getCurrentWindow().label === 'tray-menu'
if (isTrayMenu) {
  document.documentElement.dataset.win = 'tray-menu'
} else {
  initSmoothScroll()
}

// 演示模式：?demo-castle 在内存中注入一座已建成的城堡，不读写本地存档
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo-castle')) {
  markDemoMode()
  applyDemoCastleState()
}

// dev 调试钩子：CDP/控制台可直接检查应用正在使用的同一 store 实例
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__blockhabitStore = useAppStore
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isTrayMenu ? <TrayMenu /> : <App />}</React.StrictMode>,
)
