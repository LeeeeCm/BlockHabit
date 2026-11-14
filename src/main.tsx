import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { TrayMenu } from './components/TrayMenu'
import { ErrorBoundary } from './components/ErrorBoundary'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { initSmoothScroll } from './platform/smoothScroll'
import { SyncProvider } from './sync/SyncProvider'
import { applyCachedAppearance } from './platform/appearance'
import { installGlobalErrorHandlers } from './platform/errorLog'
import { applyDemoCastleState, markDemoMode, useAppStore } from './store/appStore'
// Rubik 只装 latin + latin-ext 两个子集（E1）：应用是中/英双语，阿拉伯/西里尔/希伯来/越南语
// 子集从未被请求过。用子集 CSS 替代全量子集 inline，安装包里少 32 个字体文件（约 0.4MB）。
import '@fontsource/rubik/latin-400.css'
import '@fontsource/rubik/latin-ext-400.css'
import '@fontsource/rubik/latin-500.css'
import '@fontsource/rubik/latin-ext-500.css'
import '@fontsource/rubik/latin-600.css'
import '@fontsource/rubik/latin-ext-600.css'
import '@fontsource/rubik/latin-700.css'
import '@fontsource/rubik/latin-ext-700.css'
// MiSans 只保留实际会被渲染的两个字重（E1）：Medium(500) 与 Bold(700)。
// 依据：浏览器实测（performance resource 时间线）在今日/建造/展台/统计/设置全部页面只请求
// MiSans-Medium 与 MiSans-Bold；Regular 与 Semibold 从未被下载 —— 保留它们只是在安装包里
// 白扛 2 × 1.93MB。详见 design/records/D-20261110-014。
import 'misans/lib/Normal/MiSans-Medium.min.css'
import 'misans/lib/Normal/MiSans-Bold.min.css'
import './theme.css'
import './mobile.css'
import './components/ui.css'

// 全局错误捕获先于一切初始化：启动阶段任何未捕获异常 / 未处理 Promise 拒绝都要落进本地崩溃日志
installGlobalErrorHandlers()

// 首帧外观（C8）：React 挂载前先套用上次的主题/语言，消除暗色/燕麦/雾灰主题的启动闪白
applyCachedAppearance()

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

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
  <ErrorBoundary variant={isTrayMenu ? 'tray' : 'full'}>
    <React.StrictMode>
      {/* D-20261115-074：同步控制器挂在应用级，启动/定时同步不再依赖设置页是否打开。
          托盘菜单窗口（tray-menu）不挂：两个窗口同时自动同步会并发写同一份远端。 */}
      {isTrayMenu ? (
        <TrayMenu />
      ) : (
        <SyncProvider>
          <App />
        </SyncProvider>
      )}
    </React.StrictMode>
  </ErrorBoundary>
)
