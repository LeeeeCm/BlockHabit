import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { TrayMenu } from './components/TrayMenu'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { initSmoothScroll } from './logic/smoothScroll'
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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isTrayMenu ? <TrayMenu /> : <App />}</React.StrictMode>,
)
