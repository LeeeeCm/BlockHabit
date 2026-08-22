import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { TrayMenu } from './components/TrayMenu'
import { getCurrentWindow } from '@tauri-apps/api/window'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import '@fontsource/zcool-qingke-huangyou/chinese-simplified.css'
import 'misans/lib/Normal/MiSans-Regular.min.css'
import 'misans/lib/Normal/MiSans-Medium.min.css'
import './theme.css'
import './components/ui.css'

const inTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const isTrayMenu = inTauri && getCurrentWindow().label === 'tray-menu'

if (isTrayMenu) {
  document.documentElement.dataset.win = 'tray-menu'
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isTrayMenu ? <TrayMenu /> : <App />}</React.StrictMode>,
)
