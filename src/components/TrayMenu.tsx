import { invoke } from '@tauri-apps/api/core'
import logoUrl from '../assets/logo-mark.svg'

async function act(action: 'open' | 'quit') {
  await invoke('tray_menu', { action })
}

/** 托盘右键菜单：应用风格的迷你弹窗（白黑圆润） */
export function TrayMenu() {
  return (
    <div className="tray-menu-root">
      <div className="tray-menu-card">
        <div className="tray-menu-head">
          <img src={logoUrl} alt="" width={22} height={22} />
          <span>BlockHabit</span>
        </div>
        <button className="tray-menu-item" onClick={() => void act('open')}>
          打开主界面
        </button>
        <button className="tray-menu-item quit" onClick={() => void act('quit')}>
          退出
        </button>
      </div>
    </div>
  )
}
